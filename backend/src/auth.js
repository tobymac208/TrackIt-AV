const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { generateSecret, generateURI, verify } = require('otplib');
const db = require('./db');
const { encrypt, decrypt } = require('./crypto');
const { isLocked, recordFailure, clearFailures } = require('./loginGuard');
const { can, permissionsFor, resourceFromRequest } = require('./permissions');

const TOKEN_EXPIRES = '8h';
const TOTP_CHALLENGE_EXPIRES = '5m';
const TOTP_ISSUER = 'AV Tracker';
const TIMING_HASH = bcrypt.hashSync('avtracker-timing-placeholder', 10);

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a string of at least 32 characters');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign({ typ: 'session', sub: user.id, username: user.username, role: user.role }, getSecret(), {
    expiresIn: TOKEN_EXPIRES,
  });
}

function signTotpChallenge(user) {
  return jwt.sign({ typ: 'totp', sub: user.id, username: user.username, role: user.role }, getSecret(), {
    expiresIn: TOTP_CHALLENGE_EXPIRES,
  });
}

function needsSetup(user) {
  return (
    (Boolean(Number(user.must_setup_totp)) && !isTotpEnabled(user)) || Boolean(Number(user.must_change_password))
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    totpEnabled: Boolean(Number(user.totp_enabled)),
    mfaRequired: Boolean(Number(user.mfa_required)),
    mustChangePassword: Boolean(Number(user.must_change_password)),
    mustSetupTotp: Boolean(Number(user.must_setup_totp)) && !isTotpEnabled(user),
    disabled: Boolean(Number(user.disabled)),
    permissions: permissionsFor(user),
    setupOnly: needsSetup(user),
  };
}

function signSetupToken(user) {
  return jwt.sign({ typ: 'setup', sub: user.id, username: user.username, role: user.role }, getSecret(), {
    expiresIn: '30m',
  });
}

function finishLogin(user) {
  if (Number(user.disabled)) {
    return null;
  }
  if (needsSetup(user)) {
    return { token: signSetupToken(user), user: publicUser(user) };
  }
  return { token: signToken(user), user: publicUser(user) };
}

function isSetupPath(req) {
  const full = `${req.baseUrl || ''}${req.path || ''}`;
  return (
    full.startsWith('/api/auth/me') ||
    full.startsWith('/api/auth/totp') ||
    full.startsWith('/api/auth/password')
  );
}

function isTotpEnabled(user) {
  return Boolean(Number(user.totp_enabled)) && Boolean(user.totp_secret);
}

function normalizeCode(code) {
  return String(code || '').replace(/\s+/g, '');
}

async function verifyTotpCode(secret, code) {
  const token = normalizeCode(code);
  if (!/^\d{6}$/.test(token)) return false;
  const result = await verify({
    secret,
    token,
    epochTolerance: 30,
  });
  return Boolean(result?.valid);
}

async function seedUsers() {
  const row = await db.prepare('SELECT COUNT(*) AS user_count FROM users').get();
  if (Number(row.user_count) > 0) return;

  const adminPassword = process.env.ADMIN_PASSWORD;
  const userPassword = process.env.USER_PASSWORD;
  if (!adminPassword || !userPassword) {
    console.warn('users table is empty; set ADMIN_PASSWORD and USER_PASSWORD to seed accounts');
    return;
  }

  await db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run('admin', bcrypt.hashSync(adminPassword, 10), 'admin');
  await db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run('user', bcrypt.hashSync(userPassword, 10), 'user');
  console.log('Seeded admin and user accounts');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, getSecret());
  } catch {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (payload.typ === 'totp') {
    return res.status(401).json({ error: 'Sign in required' });
  }
  if (payload.typ !== 'session' && payload.typ !== 'setup') {
    return res.status(401).json({ error: 'Sign in required' });
  }

  db.prepare('SELECT * FROM users WHERE id = ?')
    .get(payload.sub)
    .then((row) => {
      if (!row || Number(row.disabled)) {
        return res.status(401).json({ error: 'Sign in required' });
      }
      req.user = publicUser(row);
      req.authType = payload.typ;
      if (payload.typ === 'setup' && !isSetupPath(req)) {
        return res.status(403).json({ error: 'Finish account setup before using the app' });
      }
      next();
    })
    .catch(next);
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can do that' });
  }
  next();
}

function requireRead(resource) {
  return (req, res, next) => {
    if (can(req.user, resource, 'read')) return next();
    if (resource === 'offices' && (can(req.user, 'rooms', 'read') || can(req.user, 'hardware', 'read'))) {
      return next();
    }
    if (resource === 'rooms' && can(req.user, 'hardware', 'read')) return next();
    return res.status(403).json({ error: 'You do not have permission to view this' });
  };
}

function requireWriteAdmin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.user?.role === 'admin') return next();
  const resource = resourceFromRequest(req);
  if (resource && can(req.user, resource, 'write')) return next();
  return res.status(403).json({ error: 'You do not have permission to change this data' });
}

async function login(username, password) {
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').trim());
  const passwordHash = user?.password_hash || TIMING_HASH;
  if (!user || Number(user.disabled) || !bcrypt.compareSync(password || '', passwordHash)) {
    return null;
  }
  if (isTotpEnabled(user)) {
    return { requiresTotp: true, challengeToken: signTotpChallenge(user) };
  }
  return finishLogin(user);
}

async function completeTotpLogin(challengeToken, code) {
  let payload;
  try {
    payload = jwt.verify(challengeToken || '', getSecret());
  } catch {
    return null;
  }
  if (payload.typ !== 'totp') return null;
  if (isLocked('totp', payload.sub)) {
    return { locked: true };
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || !isTotpEnabled(user)) return null;

  let secret;
  try {
    secret = decrypt(user.totp_secret);
  } catch {
    return null;
  }
  try {
    if (!secret || !(await verifyTotpCode(secret, code))) {
      recordFailure('totp', payload.sub);
      return null;
    }
  } catch {
    recordFailure('totp', payload.sub);
    return null;
  }

  clearFailures('totp', payload.sub);
  return finishLogin(user);
}

async function getTotpStatus(userId) {
  const user = await db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(userId);
  return { enabled: Boolean(Number(user?.totp_enabled)) };
}

async function startTotpSetup(user) {
  const current = await db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(user.id);
  if (Number(current?.totp_enabled)) {
    throw Object.assign(new Error('Authenticator sign-in is already enabled'), { status: 400 });
  }

  const secret = generateSecret();
  await db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?').run(encrypt(secret), user.id);

  const uri = generateURI({
    issuer: TOTP_ISSUER,
    label: user.username,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { qrDataUrl, secret };
}

async function enableTotp(user, code) {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!row?.totp_secret) {
    throw Object.assign(new Error('Start authenticator setup first'), { status: 400 });
  }
  if (Number(row.totp_enabled)) {
    throw Object.assign(new Error('Authenticator sign-in is already enabled'), { status: 400 });
  }

  const secret = decrypt(row.totp_secret);
  if (!secret || !(await verifyTotpCode(secret, code))) {
    throw Object.assign(new Error('Invalid authenticator code'), { status: 401 });
  }

  await db.prepare('UPDATE users SET totp_enabled = 1, must_setup_totp = 0 WHERE id = ?').run(user.id);
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return { enabled: true, ...finishLogin(updated) };
}

async function changePassword(user, currentPassword, newPassword) {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!row) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  if (!bcrypt.compareSync(currentPassword || '', row.password_hash)) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
  }
  const next = String(newPassword || '');
  if (next.length < 8) {
    throw Object.assign(new Error('New password must be at least 8 characters'), { status: 400 });
  }
  if (bcrypt.compareSync(next, row.password_hash)) {
    throw Object.assign(new Error('New password must be different from the current password'), { status: 400 });
  }
  await db
    .prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(next, 10), user.id);
  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return finishLogin(updated);
}

async function disableTotp(user, code) {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!isTotpEnabled(row)) {
    throw Object.assign(new Error('Authenticator sign-in is not enabled'), { status: 400 });
  }
  if (Number(row.mfa_required)) {
    throw Object.assign(new Error('This account requires authenticator sign-in'), { status: 403 });
  }

  const secret = decrypt(row.totp_secret);
  if (!secret || !(await verifyTotpCode(secret, code))) {
    throw Object.assign(new Error('Invalid authenticator code'), { status: 401 });
  }

  await db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?').run(user.id);
  return { enabled: false };
}

module.exports = {
  seedUsers,
  requireAuth,
  requireAdmin,
  requireRead,
  requireWriteAdmin,
  login,
  completeTotpLogin,
  getTotpStatus,
  startTotpSetup,
  enableTotp,
  disableTotp,
  changePassword,
  publicUser,
  finishLogin,
};
