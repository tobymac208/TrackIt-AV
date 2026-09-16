const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const asyncHandler = require('../asyncHandler');
const { publicUser } = require('../auth');
const { MAX_ADMINS, VIEW_ONLY, isPrimaryAdmin, normalizePermissions } = require('../permissions');

const router = express.Router();

function validateUsername(username) {
  const value = String(username || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(value)) {
    return { error: 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens' };
  }
  return { value };
}

function validatePassword(password) {
  if (!password || String(password).length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  return { value: String(password) };
}

async function adminCount() {
  const row = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND disabled = 0").get();
  return Number(row.c);
}

function mapManagedUser(row) {
  return {
    ...publicUser(row),
    created_at: row.created_at,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await db.prepare('SELECT * FROM users ORDER BY username').all();
    res.json(rows.map(mapManagedUser));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const username = validateUsername(req.body?.username);
    if (username.error) return res.status(400).json({ error: username.error });
    const password = validatePassword(req.body?.password);
    if (password.error) return res.status(400).json({ error: password.error });

    if (isPrimaryAdmin({ username: username.value })) {
      return res.status(400).json({ error: 'The primary administrator username is reserved' });
    }

    const role = req.body?.role === 'admin' ? 'admin' : 'user';
    if (role === 'admin' && (await adminCount()) >= MAX_ADMINS) {
      return res.status(400).json({ error: `You can have at most ${MAX_ADMINS} administrator accounts` });
    }

    const permissions =
      role === 'admin'
        ? null
        : JSON.stringify(
            req.body?.permissions !== undefined
              ? normalizePermissions(req.body.permissions)
              : {
                  offices: { read: true },
                  rooms: { read: true },
                  hardware: { read: true },
                  inventory: { read: false },
                }
          );

    try {
      const result = await db
        .prepare(
          `
        INSERT INTO users (
          username, password_hash, role, must_change_password, must_setup_totp, mfa_required, permissions
        ) VALUES (?, ?, ?, 1, 1, 1, ?)
      `
        )
        .run(username.value, bcrypt.hashSync(password.value, 10), role, permissions);
      const created = await db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(mapManagedUser(created));
    } catch (err) {
      if (db.isUniqueViolation(err)) {
        return res.status(409).json({ error: 'That username is already taken' });
      }
      throw err;
    }
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextRole = req.body?.role === undefined ? existing.role : req.body.role === 'admin' ? 'admin' : 'user';
    if (nextRole !== 'admin' && nextRole !== 'user') {
      return res.status(400).json({ error: 'Role must be admin or user' });
    }

    if (isPrimaryAdmin(existing) && nextRole !== existing.role) {
      return res.status(400).json({ error: 'The primary administrator cannot be changed to a custom user' });
    }

    if (Number(req.params.id) === Number(req.user.id) && nextRole !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own administrator access' });
    }

    if (existing.role !== 'admin' && nextRole === 'admin' && (await adminCount()) >= MAX_ADMINS) {
      return res.status(400).json({ error: `You can have at most ${MAX_ADMINS} administrator accounts` });
    }

    if (existing.role === 'admin' && nextRole !== 'admin') {
      const remaining = await adminCount();
      if (remaining <= 1) {
        return res.status(400).json({ error: 'At least one administrator is required' });
      }
    }

    let disabled = existing.disabled;
    if (req.body?.disabled !== undefined) {
      disabled = req.body.disabled ? 1 : 0;
      if (isPrimaryAdmin(existing) && Number(disabled) !== Number(existing.disabled)) {
        return res.status(400).json({ error: 'The primary administrator cannot be disabled' });
      }
      if (Number(req.params.id) === Number(req.user.id) && disabled) {
        return res.status(400).json({ error: 'You cannot disable your own account' });
      }
      if (existing.role === 'admin' && disabled && (await adminCount()) <= 1) {
        return res.status(400).json({ error: 'At least one administrator is required' });
      }
    }

    let passwordHash = existing.password_hash;
    let mustChangePassword = existing.must_change_password;
    if (req.body?.password) {
      const password = validatePassword(req.body.password);
      if (password.error) return res.status(400).json({ error: password.error });
      passwordHash = bcrypt.hashSync(password.value, 10);
      mustChangePassword = 1;
    }

    const permissions =
      nextRole === 'admin'
        ? null
        : JSON.stringify(
            req.body?.permissions !== undefined
              ? normalizePermissions(req.body.permissions)
              : permissionsFromExisting(existing)
          );

    await db
      .prepare(
        `
      UPDATE users SET
        role = ?,
        disabled = ?,
        password_hash = ?,
        must_change_password = ?,
        permissions = ?
      WHERE id = ?
    `
      )
      .run(nextRole, disabled, passwordHash, mustChangePassword, permissions, req.params.id);

    const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    res.json(mapManagedUser(updated));
  })
);

function permissionsFromExisting(existing) {
  if (!existing.permissions) return VIEW_ONLY;
  try {
    return normalizePermissions(JSON.parse(existing.permissions));
  } catch {
    return normalizePermissions(null);
  }
}

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (isPrimaryAdmin(existing)) {
      return res.status(400).json({ error: 'The primary administrator cannot be deleted' });
    }
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    if (existing.role === 'admin' && (await adminCount()) <= 1) {
      return res.status(400).json({ error: 'At least one administrator is required' });
    }
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.status(204).send();
  })
);

module.exports = router;
