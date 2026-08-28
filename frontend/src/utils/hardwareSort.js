const IMPORTANCE_ORDER = { low: 1, medium: 2, high: 3, critical: 4 };

function textValue(value) {
  return (value || '').toString().toLowerCase();
}

function locationValue(item) {
  if (!item.room_name) return '\uffff unassigned';
  return `${item.office_name || ''} ${item.room_name}`.toLowerCase();
}

function dateValue(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

const SORT_ACCESSORS = {
  device: (item) => textValue(`${item.manufacturer || ''} ${item.model || ''}`),
  location: locationValue,
  importance: (item) => IMPORTANCE_ORDER[item.importance_level] || 0,
  ip: (item) => textValue(item.ip_address),
  serial: (item) => textValue(item.serial_number),
  eos: (item) => dateValue(item.end_of_support_date),
  warranty: (item) => dateValue(item.end_of_warranty_date),
  cost: (item) => item.estimated_replacement_cost ?? null,
};

export function sortHardware(items, sortKey, sortDir) {
  if (!sortKey || !SORT_ACCESSORS[sortKey]) return items;

  const accessor = SORT_ACCESSORS[sortKey];
  const direction = sortDir === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    const aVal = accessor(a);
    const bVal = accessor(b);

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * direction;
    }

    return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' }) * direction;
  });
}

export const HARDWARE_SORT_COLUMNS = [
  { key: 'device', label: 'Device' },
  { key: 'location', label: 'Location' },
  { key: 'importance', label: 'Importance' },
  { key: 'ip', label: 'IP' },
  { key: 'serial', label: 'Serial #' },
  { key: 'eos', label: 'EOS Date' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'cost', label: 'Est. Cost' },
];
