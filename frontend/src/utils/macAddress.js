export function formatMacAddress(value) {
  if (!value || !value.trim()) return '';

  const hex = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (hex.length !== 12) return value;

  return hex.match(/.{2}/g).join(':');
}

export function normalizeMacAddress(value) {
  if (!value || !value.trim()) return null;
  const formatted = formatMacAddress(value.trim());
  const hex = formatted.replace(/[^0-9a-fA-F]/g, '');
  return hex.length === 12 ? formatted : value.trim();
}
