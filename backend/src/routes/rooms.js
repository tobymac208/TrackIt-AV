const express = require('express');
const db = require('../db');

const router = express.Router();

function getRoomQuery(whereClause = '') {
  return `
    SELECT cr.*,
      o.name AS office_name,
      (SELECT COUNT(*) FROM hardware h WHERE h.conference_room_id = cr.id) AS hardware_count
    FROM conference_rooms cr
    JOIN offices o ON o.id = cr.office_id
    ${whereClause}
    ORDER BY o.name, cr.name
  `;
}

router.get('/', (req, res) => {
  const { officeId } = req.query;
  if (officeId) {
    const rooms = db.prepare(getRoomQuery('WHERE cr.office_id = ?')).all(officeId);
    return res.json(rooms);
  }
  const rooms = db.prepare(getRoomQuery()).all();
  res.json(rooms);
});

router.get('/:id', (req, res) => {
  const room = db.prepare(getRoomQuery('WHERE cr.id = ?')).get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Conference room not found' });
  }
  res.json(room);
});

router.get('/:id/hardware', (req, res) => {
  const room = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Conference room not found' });
  }

  const hardware = db.prepare(`
    SELECT h.*, cr.name AS room_name, o.name AS office_name
    FROM hardware h
    LEFT JOIN conference_rooms cr ON cr.id = h.conference_room_id
    LEFT JOIN offices o ON o.id = cr.office_id
    WHERE h.conference_room_id = ?
    ORDER BY h.manufacturer, h.model
  `).all(req.params.id);

  res.json(hardware.map((item) => ({ ...item, password: null })));
});

router.post('/', (req, res) => {
  const { name, officeId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!officeId) {
    return res.status(400).json({ error: 'Office is required' });
  }

  const office = db.prepare('SELECT id FROM offices WHERE id = ?').get(officeId);
  if (!office) {
    return res.status(400).json({ error: 'Office not found' });
  }

  try {
    const result = db.prepare('INSERT INTO conference_rooms (office_id, name) VALUES (?, ?)').run(officeId, name.trim());
    const room = db.prepare(getRoomQuery('WHERE cr.id = ?')).get(result.lastInsertRowid);
    res.status(201).json(room);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A room with this name already exists in this office' });
    }
    throw err;
  }
});

router.put('/:id', (req, res) => {
  const { name, officeId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!officeId) {
    return res.status(400).json({ error: 'Office is required' });
  }

  const existing = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Conference room not found' });
  }

  const office = db.prepare('SELECT id FROM offices WHERE id = ?').get(officeId);
  if (!office) {
    return res.status(400).json({ error: 'Office not found' });
  }

  try {
    db.prepare('UPDATE conference_rooms SET name = ?, office_id = ? WHERE id = ?').run(name.trim(), officeId, req.params.id);
    const room = db.prepare(getRoomQuery('WHERE cr.id = ?')).get(req.params.id);
    res.json(room);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A room with this name already exists in this office' });
    }
    throw err;
  }
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Conference room not found' });
  }

  db.prepare('UPDATE hardware SET conference_room_id = NULL WHERE conference_room_id = ?').run(req.params.id);
  db.prepare('DELETE FROM conference_rooms WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
