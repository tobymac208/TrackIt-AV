require('dotenv').config();


const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const { seedUsers, requireAuth, requireWriteAdmin } = require('./auth');

const authRouter = require('./routes/auth');
const officesRouter = require('./routes/offices');
const roomsRouter = require('./routes/rooms');
const hardwareRouter = require('./routes/hardware');

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await db.prepare('SELECT 1 AS ok').get();
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api', requireWriteAdmin);

app.use('/api/offices', officesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/hardware', hardwareRouter);

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
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    throw new Error('AUTH_SECRET must be set to a string of at least 16 characters');
  }
  await seedUsers();
  app.listen(PORT, '0.0.0.0', () => {
    const dialect = db.getDialect();
    console.log(`AV Tracker API running on http://localhost:${PORT} (${dialect})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
