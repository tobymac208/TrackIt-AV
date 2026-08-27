const express = require('express');
const db = require('../db');
const { encrypt, decrypt } = require('../crypto');

const router = express.Router();

const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'];

function mapHardwareRow(row, includePassword = false) {
  if (!row) return null;
  const { password_encrypted, ...rest } = row;
  return {
    ...rest,
    password: includePassword && password_encrypted ? decrypt(password_encrypted) : null,
    has_password: Boolean(password_encrypted),
  };
}

function buildHardwareQuery(whereClause = '') {
  return `
    SELECT h.*,
      cr.name AS room_name,
      o.name AS office_name,
      o.id AS office_id
    FROM hardware h
    LEFT JOIN conference_rooms cr ON cr.id = h.conference_room_id
    LEFT JOIN offices o ON o.id = cr.office_id
    ${whereClause}
    ORDER BY h.manufacturer, h.model
  `;
}

function validateHardware(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate || body.manufacturer !== undefined) {
    if (!body.manufacturer || !body.manufacturer.trim()) errors.push('Manufacturer is required');
  }
  if (!isUpdate || body.model !== undefined) {
    if (!body.model || !body.model.trim()) errors.push('Model is required');
  }
  if (!isUpdate || body.importanceLevel !== undefined) {
    if (!body.importanceLevel || !IMPORTANCE_LEVELS.includes(body.importanceLevel)) {
      errors.push('Importance level must be low, medium, high, or critical');
    }
  }
  return errors;
}

router.get('/', (req, res) => {
  const { importance, unassigned, eosSoon } = req.query;
  const conditions = [];
  const params = [];

  if (importance) {
    conditions.push('h.importance_level = ?');
    params.push(importance);
  }
  if (unassigned === 'true') {
    conditions.push('h.conference_room_id IS NULL');
  }
  if (eosSoon === 'true') {
    conditions.push("h.end_of_support_date IS NOT NULL AND h.end_of_support_date <= date('now', '+90 days')");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(buildHardwareQuery(whereClause)).all(...params);
  res.json(rows.map((row) => mapHardwareRow(row)));
});

router.get('/:id', (req, res) => {
  const { revealPassword } = req.query;
  const row = db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Hardware not found' });
  }
  res.json(mapHardwareRow(row, revealPassword === 'true'));
});

router.post('/', (req, res) => {
  const errors = validateHardware(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const {
    manufacturer,
    model,
    description,
    estimatedReplacementCost,
    macAddress,
    ipAddress,
    serialNumber,
    softwareVersion,
    username,
    password,
    importanceLevel,
    endOfSupportDate,
    upgradeRecommendations,
    conferenceRoomId,
  } = req.body;

  if (conferenceRoomId) {
    const room = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(conferenceRoomId);
    if (!room) {
      return res.status(400).json({ error: 'Conference room not found' });
    }
  }

  const result = db.prepare(`
    INSERT INTO hardware (
      conference_room_id, manufacturer, model, description, estimated_replacement_cost,
      mac_address, ip_address, serial_number, software_version, username, password_encrypted,
      importance_level, end_of_support_date, upgrade_recommendations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conferenceRoomId || null,
    manufacturer.trim(),
    model.trim(),
    description || null,
    estimatedReplacementCost ?? null,
    macAddress || null,
    ipAddress || null,
    serialNumber || null,
    softwareVersion || null,
    username || null,
    password ? encrypt(password) : null,
    importanceLevel,
    endOfSupportDate || null,
    upgradeRecommendations || null
  );

  const row = db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(result.lastInsertRowid);
  res.status(201).json(mapHardwareRow(row));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM hardware WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Hardware not found' });
  }

  const errors = validateHardware(req.body, true);
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const {
    manufacturer = existing.manufacturer,
    model = existing.model,
    description = existing.description,
    estimatedReplacementCost = existing.estimated_replacement_cost,
    macAddress = existing.mac_address,
    ipAddress = existing.ip_address,
    serialNumber = existing.serial_number,
    softwareVersion = existing.software_version,
    username = existing.username,
    password,
    importanceLevel = existing.importance_level,
    endOfSupportDate = existing.end_of_support_date,
    upgradeRecommendations = existing.upgrade_recommendations,
    conferenceRoomId = existing.conference_room_id,
  } = req.body;

  if (conferenceRoomId) {
    const room = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(conferenceRoomId);
    if (!room) {
      return res.status(400).json({ error: 'Conference room not found' });
    }
  }

  let passwordEncrypted = existing.password_encrypted;
  if (password !== undefined) {
    passwordEncrypted = password ? encrypt(password) : null;
  }

  db.prepare(`
    UPDATE hardware SET
      conference_room_id = ?,
      manufacturer = ?,
      model = ?,
      description = ?,
      estimated_replacement_cost = ?,
      mac_address = ?,
      ip_address = ?,
      serial_number = ?,
      software_version = ?,
      username = ?,
      password_encrypted = ?,
      importance_level = ?,
      end_of_support_date = ?,
      upgrade_recommendations = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    conferenceRoomId || null,
    manufacturer.trim(),
    model.trim(),
    description || null,
    estimatedReplacementCost ?? null,
    macAddress || null,
    ipAddress || null,
    serialNumber || null,
    softwareVersion || null,
    username || null,
    passwordEncrypted,
    importanceLevel,
    endOfSupportDate || null,
    upgradeRecommendations || null,
    req.params.id
  );

  const row = db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
  res.json(mapHardwareRow(row));
});

router.patch('/:id/assign', (req, res) => {
  const existing = db.prepare('SELECT id FROM hardware WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Hardware not found' });
  }

  const { conferenceRoomId } = req.body;
  if (conferenceRoomId !== null && conferenceRoomId !== undefined) {
    const room = db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(conferenceRoomId);
    if (!room) {
      return res.status(400).json({ error: 'Conference room not found' });
    }
  }

  db.prepare(`
    UPDATE hardware SET conference_room_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(conferenceRoomId ?? null, req.params.id);

  const row = db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
  res.json(mapHardwareRow(row));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM hardware WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Hardware not found' });
  }

  db.prepare('DELETE FROM hardware WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
