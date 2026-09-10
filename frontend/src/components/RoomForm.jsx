import { useState } from 'react';

const ROOM_STATUSES = [
  { value: 'functional', label: 'Functional' },
  { value: 'issue', label: 'Issue' },
];

export default function RoomForm({ initial, offices, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [officeId, setOfficeId] = useState(initial?.office_id?.toString() || offices[0]?.id?.toString() || '');
  const [status, setStatus] = useState(initial?.status || 'functional');
  const [issueDescription, setIssueDescription] = useState(initial?.issue_description || '');
  const [error, setError] = useState('');

  const handleStatusChange = (e) => {
    const next = e.target.value;
    setStatus(next);
    if (next !== 'issue') {
      setIssueDescription('');
    }
  };

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
    if (status === 'issue' && !issueDescription.trim()) {
      setError('Issue description is required');
      return;
    }
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        officeId: Number(officeId),
        status,
        issueDescription: status === 'issue' ? issueDescription.trim() : '',
      });
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
          <select id="room-status" value={status} onChange={handleStatusChange}>
            {ROOM_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {status === 'issue' && (
          <div className="form-field full-width">
            <label htmlFor="room-issue-description" className="required">
              Issue Description
            </label>
            <textarea
              id="room-issue-description"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe what is wrong with this room"
              required
            />
          </div>
        )}
      </div>
    </form>
  );
}
