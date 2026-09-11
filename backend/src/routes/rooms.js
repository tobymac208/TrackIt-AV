const express = require('express');
const db = require('../db');
const asyncHandler = require('../asyncHandler');
const { mapHardwareRow } = require('../hardwareMap');
const { syncPrimaryRoom, withRooms } = require('../hardwareRooms');

const router = express.Router();

const ROOM_STATUSES = ['functional', 'issue'];

function normalizeRoomStatus(value) {
  if (!value) return 'functional';
  const status = value.trim().toLowerCase();
  return ROOM_STATUSES.includes(status) ? status : null;
}

function normalizeIssueDescription(status, value) {
  if (status !== 'issue') return null;
  return (value || '').trim() || null;
}

function getRoomQuery(whereClause = '') {
  return `
    SELECT cr.*,
      o.name AS office_name,
      (SELECT COUNT(*) FROM hardware_rooms hr WHERE hr.conference_room_id = cr.id) AS hardware_count
    FROM conference_rooms cr
    JOIN offices o ON o.id = cr.office_id
    ${whereClause}
    ORDER BY o.name, cr.name
  `;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { officeId } = req.query;
    if (officeId) {
      const rooms = await db.prepare(getRoomQuery('WHERE cr.office_id = ?')).all(officeId);
      return res.json(rooms);
    }
    const rooms = await db.prepare(getRoomQuery()).all();
    res.json(rooms);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const room = await db.prepare(getRoomQuery('WHERE cr.id = ?')).get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Conference room not found' });
    }
    res.json(room);
  })
);

router.get(
  '/:id/hardware',
  asyncHandler(async (req, res) => {
    const room = await db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Conference room not found' });
    }

    const hardware = await db
      .prepare(
        `
    SELECT h.*, cr.name AS room_name, o.name AS office_name
    FROM hardware h
    JOIN hardware_rooms hr ON hr.hardware_id = h.id
    JOIN conference_rooms cr ON cr.id = hr.conference_room_id
    JOIN offices o ON o.id = cr.office_id
    WHERE hr.conference_room_id = ?
    ORDER BY h.manufacturer, h.model
  `
      )
      .all(req.params.id);

    res.json(await withRooms(hardware, (item) => mapHardwareRow(item)));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, officeId, status, issueDescription } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!officeId) {
      return res.status(400).json({ error: 'Office is required' });
    }

    const roomStatus = normalizeRoomStatus(status);
    if (status !== undefined && status !== null && status !== '' && !roomStatus) {
      return res.status(400).json({ error: 'Status must be functional or issue' });
    }

    const issueText = normalizeIssueDescription(roomStatus || 'functional', issueDescription);
    if ((roomStatus || 'functional') === 'issue' && !issueText) {
      return res.status(400).json({ error: 'Issue description is required when status is Issue' });
    }

    const office = await db.prepare('SELECT id FROM offices WHERE id = ?').get(officeId);
    if (!office) {
      return res.status(400).json({ error: 'Office not found' });
    }

    try {
      const result = await db
        .prepare('INSERT INTO conference_rooms (office_id, name, status, issue_description) VALUES (?, ?, ?, ?)')
        .run(officeId, name.trim(), roomStatus || 'functional', issueText);
      const room = await db.prepare(getRoomQuery('WHERE cr.id = ?')).get(result.lastInsertRowid);
      res.status(201).json(room);
    } catch (err) {
      if (db.isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A room with this name already exists in this office' });
      }
      throw err;
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, officeId, status, issueDescription } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!officeId) {
      return res.status(400).json({ error: 'Office is required' });
    }

    const roomStatus = normalizeRoomStatus(status);
    if (status !== undefined && status !== null && status !== '' && !roomStatus) {
      return res.status(400).json({ error: 'Status must be functional or issue' });
    }

    const existing = await db.prepare('SELECT * FROM conference_rooms WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Conference room not found' });
    }

    const nextStatus = roomStatus || existing.status || 'functional';
    const issueText = normalizeIssueDescription(nextStatus, issueDescription);
    if (nextStatus === 'issue' && !issueText) {
      return res.status(400).json({ error: 'Issue description is required when status is Issue' });
    }

    const office = await db.prepare('SELECT id FROM offices WHERE id = ?').get(officeId);
    if (!office) {
      return res.status(400).json({ error: 'Office not found' });
    }

    try {
      await db
        .prepare('UPDATE conference_rooms SET name = ?, office_id = ?, status = ?, issue_description = ? WHERE id = ?')
        .run(name.trim(), officeId, nextStatus, issueText, req.params.id);
      const room = await db.prepare(getRoomQuery('WHERE cr.id = ?')).get(req.params.id);
      res.json(room);
    } catch (err) {
      if (db.isUniqueViolation(err)) {
        return res.status(409).json({ error: 'A room with this name already exists in this office' });
      }
      throw err;
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Conference room not found' });
    }

    const linked = await db
      .prepare('SELECT hardware_id FROM hardware_rooms WHERE conference_room_id = ?')
      .all(req.params.id);
    await db.prepare('DELETE FROM conference_rooms WHERE id = ?').run(req.params.id);
    for (const row of linked) {
      await syncPrimaryRoom(row.hardware_id);
    }
    res.status(204).send();
  })
);

module.exports = router;
