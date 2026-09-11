const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { generateSecret, generateURI, verify } = require('otplib');
const db = require('./db');
const { encrypt, decrypt } = require('./crypto');
const { isLocked, recordFailure, clearFailures } = require('./loginGuard');

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

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    totpEnabled: Boolean(Number(user.totp_enabled)),
  };
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

  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.typ === 'totp') {
      return res.status(401).json({ error: 'Sign in required' });
    }
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
  const passwordHash = user?.password_hash || TIMING_HASH;
  if (!user || !bcrypt.compareSync(password || '', passwordHash)) {
    return null;
  }
  if (isTotpEnabled(user)) {
    return { requiresTotp: true, challengeToken: signTotpChallenge(user) };
  }
  return { token: signToken(user), user: publicUser(user) };
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
  return { token: signToken(user), user: publicUser(user) };
}

async function getTotpStatus(userId) {
  const user = await db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(userId);
  return { enabled: Boolean(Number(user?.totp_enabled)) };
}

async function startTotpSetup(user) {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Only the admin account can enable authenticator sign-in'), { status: 403 });
  }

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

  await db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  return { enabled: true };
}

async function disableTotp(user, code) {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!isTotpEnabled(row)) {
    throw Object.assign(new Error('Authenticator sign-in is not enabled'), { status: 400 });
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
  requireWriteAdmin,
  login,
  completeTotpLogin,
  getTotpStatus,
  startTotpSetup,
  enableTotp,
  disableTotp,
  publicUser,
};
