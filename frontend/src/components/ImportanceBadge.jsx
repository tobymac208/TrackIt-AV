export default function ImportanceBadge({ level }) {
  return <span className={`badge badge-${level}`}>{level}</span>;
}

export function isEosSoon(dateStr) {
  if (!dateStr) return false;
  const eos = new Date(dateStr);
  const now = new Date();
  const diff = (eos - now) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 90;
}

export function isEosPast(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

export function formatCost(cost) {
  if (cost == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost);
}
