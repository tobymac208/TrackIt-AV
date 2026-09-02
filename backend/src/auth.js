const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const TOKEN_EXPIRES = '7d';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to a string of at least 16 characters');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, getSecret(), {
    expiresIn: TOKEN_EXPIRES,
  });
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role };
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

  try {
    const payload = jwt.verify(token, getSecret());
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Sign in required' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'View-only users cannot change data' });
  }
  next();
}

function requireWriteAdmin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireAdmin(req, res, next);
}

async function login(username, password) {
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').trim());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return null;
  }
  return { token: signToken(user), user: publicUser(user) };
}

module.exports = {
  seedUsers,
  requireAuth,
  requireAdmin,
  requireWriteAdmin,
  login,
  publicUser,
};
