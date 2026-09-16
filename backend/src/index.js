require('dotenv').config();


const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const { seedUsers, lockSharedAccount, requireAuth, requireAdmin, requireRead, requireWriteAdmin } = require('./auth');

const authRouter = require('./routes/auth');
const officesRouter = require('./routes/offices');
const roomsRouter = require('./routes/rooms');
const hardwareRouter = require('./routes/hardware');
const inventoryRouter = require('./routes/inventory');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');

app.set('trust proxy', 1);

const corsAllowlist = new Set(
  [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3001',
    'https://avtracker-production.up.railway.app',
    ...(process.env.CORS_ORIGIN || '').split(','),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsAllowlist.has(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
app.use(express.json({ limit: '10mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' },
});

app.get('/api/health', async (_req, res) => {
  try {
    await db.prepare('SELECT 1 AS ok').get();
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api', requireWriteAdmin);

app.use('/api/offices', requireRead('offices'), officesRouter);
app.use('/api/rooms', requireRead('rooms'), roomsRouter);
app.use('/api/hardware', requireRead('hardware'), hardwareRouter);
app.use('/api/inventory', requireRead('inventory'), inventoryRouter);
app.use('/api/users', requireAdmin, usersRouter);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await db.init();
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET must be set to a string of at least 32 characters');
  }
  await seedUsers();
  await lockSharedAccount();
  app.listen(PORT, '0.0.0.0', () => {
    const dialect = db.getDialect();
    console.log(`TrackIt! AV API running on http://localhost:${PORT} (${dialect})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
