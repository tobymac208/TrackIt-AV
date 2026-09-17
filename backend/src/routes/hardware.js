const express = require('express');
const db = require('../db');
const asyncHandler = require('../asyncHandler');
const { encrypt } = require('../crypto');
const { mapHardwareRow } = require('../hardwareMap');
const { parseCsv } = require('../csvParser');
const { normalizeMacAddress } = require('../macAddress');
const { loadRoomIndex, loadOffices, resolveConferenceRoomLocation } = require('../roomMatcher');
const { can } = require('../permissions');
const {
  parseRoomIds,
  assertRoomsExist,
  setHardwareRooms,
  addHardwareRoom,
  removeHardwareRoom,
  withRooms,
} = require('../hardwareRooms');

const router = express.Router();

const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'];
// POSIX regex (Postgres ~): use [0-9], not \\d. Compare YYYY-MM-DD as text to avoid ::date errors on bad imports.
const ISO_DATE_PATTERN = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

function eosSoonCondition() {
  if (db.getDialect() === 'postgres') {
    return `(h.end_of_support_date IS NOT NULL AND btrim(h.end_of_support_date) <> '' AND h.end_of_support_date ~ '${ISO_DATE_PATTERN}' AND h.end_of_support_date <= to_char(CURRENT_DATE + 90, 'YYYY-MM-DD'))`;
  }
  return "(h.end_of_support_date IS NOT NULL AND h.end_of_support_date <> '' AND h.end_of_support_date <= date('now', '+90 days'))";
}

function warrantyExpiredCondition() {
  if (db.getDialect() === 'postgres') {
    return `(h.end_of_warranty_date IS NOT NULL AND btrim(h.end_of_warranty_date) <> '' AND h.end_of_warranty_date ~ '${ISO_DATE_PATTERN}' AND h.end_of_warranty_date < to_char(CURRENT_DATE, 'YYYY-MM-DD'))`;
  }
  return "(h.end_of_warranty_date IS NOT NULL AND h.end_of_warranty_date <> '' AND h.end_of_warranty_date < date('now'))";
}

const insertHardwareStmt = db.prepare(`
  INSERT INTO hardware (
    conference_room_id, manufacturer, model, description, estimated_replacement_cost,
    mac_address, ip_address, serial_number, software_version, username, password_encrypted,
    importance_level, end_of_support_date, end_of_warranty_date, upgrade_recommendations
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

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

function sendRoomError(err, res) {
  if (err.status) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

async function insertHardwareRecord(data) {
  const roomIds = parseRoomIds(data);
  const result = await insertHardwareStmt.run(
    roomIds[0] || null,
    data.manufacturer.trim(),
    data.model.trim(),
    data.description || null,
    data.estimatedReplacementCost ?? null,
    data.macAddress ? normalizeMacAddress(data.macAddress) : null,
    data.ipAddress || null,
    data.serialNumber || null,
    data.softwareVersion || null,
    data.username || null,
    data.password ? encrypt(data.password) : null,
    data.importanceLevel,
    data.endOfSupportDate || null,
    data.endOfWarrantyDate || null,
    data.upgradeRecommendations || null
  );

  const created = await db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(result.lastInsertRowid);
  if (roomIds.length) {
    await setHardwareRooms(created.id, roomIds);
  }
  return withRooms(created, (row) => row);
}

function resolveImportLocation(row, offices, roomIndex, defaults) {
  const hasCsvLocation = Boolean(
    (row.office && row.office.trim()) ||
      (row.room && row.room.trim()) ||
      row.belongsToParsed
  );

  if (hasCsvLocation) {
    return resolveConferenceRoomLocation(
      {
        office: row.office || defaults.officeName || null,
        room: row.room,
        belongsToParsed: row.belongsToParsed,
      },
      offices,
      roomIndex
    );
  }

  if (defaults.conferenceRoomId) {
    return { conferenceRoomId: defaults.conferenceRoomId, warnings: [] };
  }

  return { conferenceRoomId: null, warnings: [] };
}

function validateImportRow(row, offices, roomIndex, defaults = {}) {
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

  const endOfWarrantyDate = normalizeDate(row.endOfWarrantyDate);
  if (row.endOfWarrantyDate && !endOfWarrantyDate) {
    errors.push('End of warranty date must be YYYY-MM-DD or a valid date');
  }

  const roomResult = resolveImportLocation(row, offices, roomIndex, defaults);
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
          macAddress: row.macAddress ? normalizeMacAddress(row.macAddress) : null,
          ipAddress: row.ipAddress || null,
          serialNumber: row.serialNumber || null,
          softwareVersion: row.softwareVersion || null,
          username: row.username || null,
          password: row.password || null,
          importanceLevel,
          endOfSupportDate,
          endOfWarrantyDate,
          upgradeRecommendations: row.upgradeRecommendations || null,
          conferenceRoomId: roomResult.conferenceRoomId ?? null,
        },
  };
}

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const { csv, officeId, conferenceRoomId } = req.body;
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

    const offices = await loadOffices(db);
    const roomIndex = await loadRoomIndex(db);
    const defaults = { officeName: null, conferenceRoomId: null };

    if (conferenceRoomId) {
      const room = roomIndex.find((entry) => Number(entry.id) === Number(conferenceRoomId));
      if (!room) {
        return res.status(400).json({ error: 'Selected conference room was not found' });
      }
      defaults.conferenceRoomId = room.id;
      defaults.officeName = room.office_name;
    } else if (officeId) {
      const office = offices.find((entry) => Number(entry.id) === Number(officeId));
      if (!office) {
        return res.status(400).json({ error: 'Selected office was not found' });
      }
      defaults.officeName = office.name;
    }

    const imported = [];
    const failed = [];
    const warnings = [];

    for (const row of rows) {
      const { errors, warnings: rowWarnings, data } = validateImportRow(row, offices, roomIndex, defaults);
      if (errors.length) {
        failed.push({ line: row._line, errors });
        continue;
      }

      rowWarnings.forEach((message) => {
        warnings.push({ line: row._line, message });
      });

      try {
        const created = await insertHardwareRecord(data);
        imported.push(mapHardwareRow(created, false));
      } catch (err) {
        failed.push({ line: row._line, errors: [err.message] });
      }
    }

    res.json({
      imported: imported.length,
      failed,
      warnings,
      items: imported,
    });
  })
);

router.patch('/bulk-update', asyncHandler(async (req, res) => {
  const { ids, updates } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'At least one hardware id is required' });
  }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Updates object is required' });
  }

  const setClauses = [];
  const values = [];

  if (updates.importanceLevel !== undefined) {
    if (!IMPORTANCE_LEVELS.includes(updates.importanceLevel)) {
      return res.status(400).json({ error: 'Importance level must be low, medium, high, or critical' });
    }
    setClauses.push('importance_level = ?');
    values.push(updates.importanceLevel);
  }

  if (updates.endOfSupportDate !== undefined) {
    if (updates.endOfSupportDate === null) {
      setClauses.push('end_of_support_date = NULL');
    } else {
      const date = normalizeDate(updates.endOfSupportDate);
      if (!date) {
        return res.status(400).json({ error: 'End of support date must be YYYY-MM-DD or a valid date' });
      }
      setClauses.push('end_of_support_date = ?');
      values.push(date);
    }
  }

  if (updates.endOfWarrantyDate !== undefined) {
    if (updates.endOfWarrantyDate === null) {
      setClauses.push('end_of_warranty_date = NULL');
    } else {
      const date = normalizeDate(updates.endOfWarrantyDate);
      if (!date) {
        return res.status(400).json({ error: 'End of warranty date must be YYYY-MM-DD or a valid date' });
      }
      setClauses.push('end_of_warranty_date = ?');
      values.push(date);
    }
  }

  if (updates.upgradeRecommendations !== undefined) {
    setClauses.push('upgrade_recommendations = ?');
    values.push(updates.upgradeRecommendations || null);
  }

  if (updates.estimatedReplacementCost !== undefined) {
    const cost =
      updates.estimatedReplacementCost === null || updates.estimatedReplacementCost === ''
        ? null
        : parseCost(updates.estimatedReplacementCost);
    if (updates.estimatedReplacementCost != null && updates.estimatedReplacementCost !== '' && cost === null) {
      return res.status(400).json({ error: 'Estimated replacement cost must be a number' });
    }
    setClauses.push('estimated_replacement_cost = ?');
    values.push(cost);
  }

  const uniqueIds = [...new Set(ids.map(Number))].filter(Boolean);

  if (updates.conferenceRoomId !== undefined) {
    const roomIds = updates.conferenceRoomId ? [updates.conferenceRoomId] : [];
    for (const hardwareId of uniqueIds) {
      await setHardwareRooms(hardwareId, roomIds);
    }
  }

  if (setClauses.length === 0 && updates.conferenceRoomId === undefined) {
    return res.status(400).json({ error: 'No fields selected to update' });
  }

  if (setClauses.length > 0) {
    setClauses.push("updated_at = datetime('now')");
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const result = await db
      .prepare(`UPDATE hardware SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`)
      .run(...values, ...uniqueIds);
    return res.json({ updated: result.changes, ids: uniqueIds });
  }

  res.json({ updated: uniqueIds.length, ids: uniqueIds });
}));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { importance, unassigned, eosSoon, warrantyExpired } = req.query;
    const conditions = [];
    const params = [];

    if (importance) {
      conditions.push('h.importance_level = ?');
      params.push(importance);
    }
    if (unassigned === 'true') {
      conditions.push('NOT EXISTS (SELECT 1 FROM hardware_rooms hr WHERE hr.hardware_id = h.id)');
    }
    if (eosSoon === 'true') {
      conditions.push(eosSoonCondition());
    }
    if (warrantyExpired === 'true') {
      conditions.push(warrantyExpiredCondition());
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.prepare(buildHardwareQuery(whereClause)).all(...params);
    res.json(await withRooms(rows, (row) => mapHardwareRow(row)));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { revealPassword } = req.query;
    if (revealPassword === 'true' && !can(req.user, 'hardware', 'write')) {
      return res.status(403).json({ error: 'You do not have permission to reveal passwords' });
    }
    const row = await db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Hardware not found' });
    }
    res.json(await withRooms(row, (item) => mapHardwareRow(item, revealPassword === 'true')));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
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
    endOfWarrantyDate,
    upgradeRecommendations,
  } = req.body;

  const roomIds = parseRoomIds(req.body);
  try {
    await assertRoomsExist(roomIds);
  } catch (err) {
    if (sendRoomError(err, res)) return;
    throw err;
  }

  const created = await insertHardwareRecord({
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
    endOfWarrantyDate,
    upgradeRecommendations,
    conferenceRoomIds: roomIds,
  });
  res.status(201).json(mapHardwareRow(created));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
  const existing = await db.prepare('SELECT * FROM hardware WHERE id = ?').get(req.params.id);
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
    endOfWarrantyDate = existing.end_of_warranty_date,
    upgradeRecommendations = existing.upgrade_recommendations,
  } = req.body;

  const roomsProvided =
    Array.isArray(req.body.conferenceRoomIds) || req.body.conferenceRoomId !== undefined;
  const roomIds = roomsProvided ? parseRoomIds(req.body) : null;
  if (roomIds) {
    try {
      await assertRoomsExist(roomIds);
    } catch (err) {
      if (sendRoomError(err, res)) return;
      throw err;
    }
  }

  let passwordEncrypted = existing.password_encrypted;
  if (password !== undefined) {
    passwordEncrypted = password ? encrypt(password) : null;
  }

  await db
    .prepare(
      `
    UPDATE hardware SET
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
      end_of_warranty_date = ?,
      upgrade_recommendations = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `
    )
    .run(
      manufacturer.trim(),
      model.trim(),
      description || null,
      estimatedReplacementCost ?? null,
      macAddress ? normalizeMacAddress(macAddress) : null,
      ipAddress || null,
      serialNumber || null,
      softwareVersion || null,
      username || null,
      passwordEncrypted,
      importanceLevel,
      endOfSupportDate || null,
      endOfWarrantyDate || null,
      upgradeRecommendations || null,
      req.params.id
    );

  if (roomIds) {
    try {
      await setHardwareRooms(req.params.id, roomIds);
    } catch (err) {
      if (sendRoomError(err, res)) return;
      throw err;
    }
  }

  const row = await db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
  res.json(await withRooms(row, (item) => mapHardwareRow(item)));
  })
);

router.patch(
  '/:id/assign',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM hardware WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Hardware not found' });
    }

    const { conferenceRoomId, fromRoomId } = req.body;
    try {
      if (conferenceRoomId !== null && conferenceRoomId !== undefined) {
        await addHardwareRoom(req.params.id, Number(conferenceRoomId));
      } else if (fromRoomId) {
        await removeHardwareRoom(req.params.id, Number(fromRoomId));
      } else {
        await setHardwareRooms(req.params.id, []);
      }
    } catch (err) {
      if (sendRoomError(err, res)) return;
      throw err;
    }

    const row = await db.prepare(buildHardwareQuery('WHERE h.id = ?')).get(req.params.id);
    res.json(await withRooms(row, (item) => mapHardwareRow(item)));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await db.prepare('SELECT id FROM hardware WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Hardware not found' });
    }

    await db.prepare('DELETE FROM hardware WHERE id = ?').run(req.params.id);
    res.status(204).send();
  })
);

module.exports = router;
