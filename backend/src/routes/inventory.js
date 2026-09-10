const express = require('express');
const db = require('../db');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

function parseItem(body) {
  const manufacturer = (body.manufacturer || '').trim();
  const model = (body.model || '').trim();
  const quantity = Number(body.quantity);
  const location = (body.location || '').trim() || null;
  const notes = (body.notes || '').trim() || null;
  return { manufacturer, model, quantity, location, notes };
}

function validateItem(item) {
  if (!item.manufacturer) return 'Manufacturer is required';
  if (!item.model) return 'Model is required';
  if (!Number.isInteger(item.quantity) || item.quantity < 0) {
    return 'Quantity must be a whole number of 0 or more';
  }
  return null;
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await db
      .prepare('SELECT * FROM shelf_stock ORDER BY manufacturer, model')
      .all();
    res.json(items);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const item = parseItem(req.body);
    const error = validateItem(item);
    if (error) {
      return res.status(400).json({ error });
    }

    const result = await db
      .prepare(
        'INSERT INTO shelf_stock (manufacturer, model, quantity, location, notes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(item.manufacturer, item.model, item.quantity, item.location, item.notes);
    const created = await db.prepare('SELECT * FROM shelf_stock WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM shelf_stock WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const item = parseItem(req.body);
    const error = validateItem(item);
    if (error) {
      return res.status(400).json({ error });
    }

    await db
      .prepare(
        `UPDATE shelf_stock
         SET manufacturer = ?, model = ?, quantity = ?, location = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(item.manufacturer, item.model, item.quantity, item.location, item.notes, req.params.id);
    const updated = await db.prepare('SELECT * FROM shelf_stock WHERE id = ?').get(req.params.id);
    res.json(updated);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT * FROM shelf_stock WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Quantity must be a whole number of 0 or more' });
    }

    await db
      .prepare("UPDATE shelf_stock SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
      .run(quantity, req.params.id);
    const updated = await db.prepare('SELECT * FROM shelf_stock WHERE id = ?').get(req.params.id);
    res.json(updated);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM shelf_stock WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    await db.prepare('DELETE FROM shelf_stock WHERE id = ?').run(req.params.id);
    res.status(204).send();
  })
);

module.exports = router;
