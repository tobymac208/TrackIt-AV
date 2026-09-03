const STATUS_LABELS = {
  functional: 'Functional',
  issue: 'Issue',
};

export default function RoomStatusBadge({ status }) {
  const normalized = status === 'issue' ? 'issue' : 'functional';
  return <span className={`badge badge-room-${normalized}`}>{STATUS_LABELS[normalized]}</span>;
}
