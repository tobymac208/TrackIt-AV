import { useState } from 'react';

const ROOM_STATUSES = [
  { value: 'functional', label: 'Functional' },
  { value: 'issue', label: 'Issue' },
];

export default function RoomForm({ initial, offices, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [officeId, setOfficeId] = useState(initial?.office_id?.toString() || offices[0]?.id?.toString() || '');
  const [status, setStatus] = useState(initial?.status || 'functional');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!officeId) {
      setError('Office is required');
      return;
    }
    setError('');
    try {
      await onSubmit({ name: name.trim(), officeId: Number(officeId), status });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="room-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="form-field full-width">
          <label htmlFor="room-office" className="required">
            Office
          </label>
          <select id="room-office" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">Select office...</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field full-width">
          <label htmlFor="room-name" className="required">
            Room Name
          </label>
          <input
            id="room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Boardroom A"
            autoFocus
          />
        </div>
        <div className="form-field full-width">
          <label htmlFor="room-status" className="required">
            Status
          </label>
          <select id="room-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ROOM_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
