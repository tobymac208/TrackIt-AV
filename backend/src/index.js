require('dotenv').config();

const express = require('express');
const cors = require('cors');

require('./db');

const officesRouter = require('./routes/offices');
const roomsRouter = require('./routes/rooms');
const hardwareRouter = require('./routes/hardware');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/offices', officesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/hardware', hardwareRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`AV Tracker API running on http://localhost:${PORT}`);
});
