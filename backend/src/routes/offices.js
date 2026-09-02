const express = require('express');
const db = require('../db');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const offices = await db
      .prepare(
        `
    SELECT o.*,
      (SELECT COUNT(*) FROM conference_rooms cr WHERE cr.office_id = o.id) AS room_count
    FROM offices o
    ORDER BY o.name
  `
      )
      .all();
    res.json(offices);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const office = await db
      .prepare(
        `
    SELECT o.*,
      (SELECT COUNT(*) FROM conference_rooms cr WHERE cr.office_id = o.id) AS room_count
    FROM offices o
    WHERE o.id = ?
  `
      )
      .get(req.params.id);

    if (!office) {
      return res.status(404).json({ error: 'Office not found' });
    }
    res.json(office);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const result = await db.prepare('INSERT INTO offices (name) VALUES (?)').run(name.trim());
      const office = await db.prepare('SELECT * FROM offices WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(office);
    } catch (err) {
      if (db.isUniqueViolation(err)) {
        return res.status(409).json({ error: 'An office with this name already exists' });
      }
      throw err;
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await db.prepare('SELECT id FROM offices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Office not found' });
    }

    try {
      await db.prepare('UPDATE offices SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
      const office = await db
        .prepare(
          `
      SELECT o.*,
        (SELECT COUNT(*) FROM conference_rooms cr WHERE cr.office_id = o.id) AS room_count
      FROM offices o
      WHERE o.id = ?
    `
        )
        .get(req.params.id);
      res.json(office);
    } catch (err) {
      if (db.isUniqueViolation(err)) {
        return res.status(409).json({ error: 'An office with this name already exists' });
      }
      throw err;
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM offices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Office not found' });
    }

    await db
      .prepare(
        'UPDATE hardware SET conference_room_id = NULL WHERE conference_room_id IN (SELECT id FROM conference_rooms WHERE office_id = ?)'
      )
      .run(req.params.id);
    await db.prepare('DELETE FROM offices WHERE id = ?').run(req.params.id);
    res.status(204).send();
  })
);

module.exports = router;
