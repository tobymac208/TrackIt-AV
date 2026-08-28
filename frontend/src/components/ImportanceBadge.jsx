export default function ImportanceBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>;
}

export function isDateSoon(dateStr, withinDays = 90) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  const diff = (target - now) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= withinDays;
}

export function isDatePast(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export const isEosSoon = (dateStr) => isDateSoon(dateStr);
export const isEosPast = (dateStr) => isDatePast(dateStr);
export const isWarrantySoon = (dateStr) => isDateSoon(dateStr);
export const isWarrantyPast = (dateStr) => isDatePast(dateStr);

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

export function formatCost(cost) {
  if (cost == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost);
}
