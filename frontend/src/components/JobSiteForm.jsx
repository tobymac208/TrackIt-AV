import { useState } from 'react';
import { buildJobSiteName, normalizeStateCode, parseJobSiteName, US_STATES } from '../utils/jobSite';

const ROOM_STATUSES = [
  { value: 'functional', label: 'Functional' },
  { value: 'issue', label: 'Issue' },
];

export default function JobSiteForm({ initial, onSubmit }) {
  const parsed = parseJobSiteName(initial?.name);
  const [state, setState] = useState(parsed?.state || '');
  const [roomName, setRoomName] = useState(parsed?.roomName || '');
  const [status, setStatus] = useState(initial?.status || 'functional');
  const [issueDescription, setIssueDescription] = useState(initial?.issue_description || '');
  const [error, setError] = useState('');

  const previewName = buildJobSiteName(state, roomName);

  const handleStatusChange = (e) => {
    const next = e.target.value;
    setStatus(next);
    if (next !== 'issue') {
      setIssueDescription('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!previewName) {
      setError('State and conference room name are required');
      return;
    }
    if (status === 'issue' && !issueDescription.trim()) {
      setError('Issue description is required');
      return;
    }
    setError('');
    try {
      await onSubmit({
        state,
        roomName,
        status,
        issueDescription: status === 'issue' ? issueDescription.trim() : '',
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="job-site-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="job-site-state" className="required">
            State
          </label>
          <select id="job-site-state" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Select state...</option>
            {state && !normalizeStateCode(state) && (
              <option value={state}>{state}</option>
            )}
            {US_STATES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name} ({entry.code})
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="job-site-room-name" className="required">
            Conference Room Name
          </label>
          <input
            id="job-site-room-name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Benning"
            autoFocus
          />
        </div>
        <div className="form-field full-width">
          <label>Room Name Preview</label>
          <p className="room-checklist-hint" style={{ margin: 0 }}>
            {previewName || 'Conf-JOB-GA-Benning'}
          </p>
        </div>
        <div className="form-field full-width">
          <label htmlFor="job-site-status" className="required">
            Status
          </label>
          <select id="job-site-status" value={status} onChange={handleStatusChange}>
            {ROOM_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {status === 'issue' && (
          <div className="form-field full-width">
            <label htmlFor="job-site-issue-description" className="required">
              Issue Description
            </label>
            <textarea
              id="job-site-issue-description"
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe what is wrong with this job site room"
              required
            />
          </div>
        )}
      </div>
    </form>
  );
}
