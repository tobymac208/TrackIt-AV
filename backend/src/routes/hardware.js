const express = require('express');
const db = require('../db');
const { encrypt, decrypt } = require('../crypto');
const { parseCsv } = require('../csvParser');
const { loadRoomIndex, loadOffices, resolveConferenceRoomLocation } = require('../roomMatcher');

const router = express.Router();

const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'];

const insertHardwareStmt = db.prepare(`
  INSERT INTO hardware (
    conference_room_id, manufacturer, model, description, estimated_replacement_cost,
    mac_address, ip_address, serial_number, software_version, username, password_encrypted,
    importance_level, end_of_support_date, upgrade_recommendations
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

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

function normalizeImportance(value) {
  if (!value) return 'medium';
  return value.trim().toLowerCase();
}

function parseCost(value) {
  if (value === undefined || value === null || value === '') return null;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function insertHardwareRecord(data) {
  const result = insertHardwareStmt.run(
    data.conferenceRoomId || null,
    data.manufacturer.trim(),
    data.model.trim(),
    data.description || null,
    data.estimatedReplacementCost ?? null,
    data.macAddress || null,
    data.ipAddress || null,
    data.serialNumber || null,
    data.softwareVersion || null,
    data.username || null,
    data.password ? encrypt(data.password) : null,
    data.importanceLevel,
    data.endOfSupportDate || null,
    data.upgradeRecommendations || null
  );

  return db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(result.lastInsertRowid);
}

function validateImportRow(row, offices, roomIndex) {
  const errors = [];
  if (!row.manufacturer || !row.manufacturer.trim()) errors.push('Manufacturer is required');
  if (!row.model || !row.model.trim()) errors.push('Model is required');

  const importanceLevel = normalizeImportance(row.importanceLevel);
  if (!IMPORTANCE_LEVELS.includes(importanceLevel)) {
    errors.push('Importance level must be low, medium, high, or critical');
  }

  const estimatedReplacementCost = parseCost(row.estimatedReplacementCost);
  if (row.estimatedReplacementCost && estimatedReplacementCost === null) {
    errors.push('Estimated replacement cost must be a number');
  }

  const endOfSupportDate = normalizeDate(row.endOfSupportDate);
  if (row.endOfSupportDate && !endOfSupportDate) {
    errors.push('End of support date must be YYYY-MM-DD or a valid date');
  }

  const roomResult = resolveConferenceRoomLocation(
    { office: row.office, room: row.room, belongsToParsed: row.belongsToParsed },
    offices,
    roomIndex
  );
  const warnings = [...(roomResult.warnings || [])];

  return {
    errors,
    warnings,
    data: errors.length
      ? null
      : {
          manufacturer: row.manufacturer,
          model: row.model,
          description: row.description || null,
          estimatedReplacementCost,
          macAddress: row.macAddress || null,
          ipAddress: row.ipAddress || null,
          serialNumber: row.serialNumber || null,
          softwareVersion: row.softwareVersion || null,
          username: row.username || null,
          password: row.password || null,
          importanceLevel,
          endOfSupportDate,
          upgradeRecommendations: row.upgradeRecommendations || null,
          conferenceRoomId: roomResult.conferenceRoomId ?? null,
        },
  };
}

router.post('/import', (req, res) => {
  const { csv } = req.body;
  if (!csv || !csv.trim()) {
    return res.status(400).json({ error: 'CSV content is required' });
  }

  let rows;
  try {
    rows = parseCsv(csv);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV contains no data rows' });
  }

  const offices = loadOffices(db);
  const roomIndex = loadRoomIndex(db);

  const imported = [];
  const failed = [];
  const warnings = [];

  rows.forEach((row) => {
    const { errors, warnings: rowWarnings, data } = validateImportRow(row, offices, roomIndex);
    if (errors.length) {
      failed.push({ line: row._line, errors });
      return;
    }

    rowWarnings.forEach((message) => {
      warnings.push({ line: row._line, message });
    });

    try {
      const created = insertHardwareRecord(data);
      imported.push(mapHardwareRow(created));
    } catch (err) {
      failed.push({ line: row._line, errors: [err.message] });
    }
  });

  res.json({
    imported: imported.length,
    failed,
    warnings,
    items: imported,
  });
});

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

  const result = insertHardwareStmt.run(
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
