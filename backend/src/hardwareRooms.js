const db = require('./db');

function parseRoomIds(body) {
  if (Array.isArray(body?.conferenceRoomIds)) {
    return [...new Set(body.conferenceRoomIds.map(Number).filter((id) => id > 0))];
  }
  if (body?.conferenceRoomId) {
    return [Number(body.conferenceRoomId)];
  }
  return [];
}

async function assertRoomsExist(roomIds) {
  for (const roomId of roomIds) {
    const room = await db.prepare('SELECT id FROM conference_rooms WHERE id = ?').get(roomId);
    if (!room) {
      throw Object.assign(new Error('Conference room not found'), { status: 400 });
    }
  }
}

async function syncPrimaryRoom(hardwareId) {
  const first = await db
    .prepare('SELECT conference_room_id FROM hardware_rooms WHERE hardware_id = ? ORDER BY conference_room_id LIMIT 1')
    .get(hardwareId);
  await db
    .prepare("UPDATE hardware SET conference_room_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(first ? first.conference_room_id : null, hardwareId);
}

async function setHardwareRooms(hardwareId, roomIds) {
  const unique = [...new Set((roomIds || []).map(Number).filter((id) => id > 0))];
  await assertRoomsExist(unique);
  await db.prepare('DELETE FROM hardware_rooms WHERE hardware_id = ?').run(hardwareId);
  for (const roomId of unique) {
    await db.prepare('INSERT INTO hardware_rooms (hardware_id, conference_room_id) VALUES (?, ?)').run(hardwareId, roomId);
  }
  await syncPrimaryRoom(hardwareId);
}

async function addHardwareRoom(hardwareId, roomId) {
  await assertRoomsExist([roomId]);
  const existing = await db
    .prepare('SELECT hardware_id FROM hardware_rooms WHERE hardware_id = ? AND conference_room_id = ?')
    .get(hardwareId, roomId);
  if (!existing) {
    await db.prepare('INSERT INTO hardware_rooms (hardware_id, conference_room_id) VALUES (?, ?)').run(hardwareId, roomId);
  }
  await syncPrimaryRoom(hardwareId);
}

async function removeHardwareRoom(hardwareId, roomId) {
  await db.prepare('DELETE FROM hardware_rooms WHERE hardware_id = ? AND conference_room_id = ?').run(hardwareId, roomId);
  await syncPrimaryRoom(hardwareId);
}

async function loadRoomsByHardwareIds(hardwareIds) {
  if (!hardwareIds.length) return {};
  const placeholders = hardwareIds.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `
    SELECT hr.hardware_id, cr.id, cr.name, o.name AS office_name
    FROM hardware_rooms hr
    JOIN conference_rooms cr ON cr.id = hr.conference_room_id
    JOIN offices o ON o.id = cr.office_id
    WHERE hr.hardware_id IN (${placeholders})
    ORDER BY o.name, cr.name
  `
    )
    .all(...hardwareIds);

  const byHardware = {};
  for (const row of rows) {
    (byHardware[row.hardware_id] ||= []).push({
      id: row.id,
      name: row.name,
      office_name: row.office_name,
    });
  }
  return byHardware;
}

async function withRooms(items, mapRow) {
  const list = Array.isArray(items) ? items.filter(Boolean) : items ? [items] : [];
  if (!list.length) return items;
  const roomsByHardware = await loadRoomsByHardwareIds(list.map((item) => item.id));
  const mapped = list.map((item) => {
    const rooms = roomsByHardware[item.id] || [];
    const first = rooms[0];
    return mapRow({
      ...item,
      rooms,
      room_name: first?.name || null,
      office_name: first?.office_name || null,
      conference_room_id: first?.id || null,
    });
  });
  return Array.isArray(items) ? mapped : mapped[0];
}

module.exports = {
  parseRoomIds,
  assertRoomsExist,
  setHardwareRooms,
  addHardwareRoom,
  removeHardwareRoom,
  syncPrimaryRoom,
  withRooms,
};
