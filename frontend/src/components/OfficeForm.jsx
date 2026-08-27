import { useState } from 'react';

export default function OfficeForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError('');
    try {
      await onSubmit({ name: name.trim() });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="office-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-field">
        <label htmlFor="office-name" className="required">
          Office Name
        </label>
        <input
          id="office-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Minneapolis HQ"
          autoFocus
        />
      </div>
    </form>
  );
}
