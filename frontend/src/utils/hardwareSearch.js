export function hardwareMatchesSearch(item, query) {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const fields = [
    `${item.manufacturer || ''} ${item.model || ''}`,
    item.manufacturer,
    item.model,
    item.description,
    item.serial_number,
    item.ip_address,
    item.mac_address,
    item.office_name,
    item.room_name,
    item.software_version,
    ...(item.rooms || []).flatMap((room) => [room.name, room.office_name, `${room.office_name} ${room.name}`]),
  ].map((value) => (value || '').toLowerCase());

  if (fields.some((field) => field.includes(q))) {
    return true;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const combined = fields.join(' ');
  return tokens.every((token) => combined.includes(token));
}
