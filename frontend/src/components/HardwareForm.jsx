import { useState } from 'react';

const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'];

const emptyForm = {
  manufacturer: '',
  model: '',
  description: '',
  estimatedReplacementCost: '',
  macAddress: '',
  ipAddress: '',
  serialNumber: '',
  softwareVersion: '',
  username: '',
  password: '',
  importanceLevel: 'medium',
  endOfSupportDate: '',
  upgradeRecommendations: '',
  conferenceRoomId: '',
};

export default function HardwareForm({ initial, rooms = [], onSubmit }) {
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(initial
      ? {
          manufacturer: initial.manufacturer || '',
          model: initial.model || '',
          description: initial.description || '',
          estimatedReplacementCost: initial.estimated_replacement_cost ?? '',
          macAddress: initial.mac_address || '',
          ipAddress: initial.ip_address || '',
          serialNumber: initial.serial_number || '',
          softwareVersion: initial.software_version || '',
          username: initial.username || '',
          password: '',
          importanceLevel: initial.importance_level || 'medium',
          endOfSupportDate: initial.end_of_support_date || '',
          upgradeRecommendations: initial.upgrade_recommendations || '',
          conferenceRoomId: initial.conference_room_id?.toString() || '',
        }
      : {}),
  }));
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.manufacturer.trim() || !form.model.trim()) {
      setError('Manufacturer and model are required');
      return;
    }
    setError('');
    try {
      await onSubmit({
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        description: form.description || null,
        estimatedReplacementCost: form.estimatedReplacementCost !== '' ? Number(form.estimatedReplacementCost) : null,
        macAddress: form.macAddress || null,
        ipAddress: form.ipAddress || null,
        serialNumber: form.serialNumber || null,
        softwareVersion: form.softwareVersion || null,
        username: form.username || null,
        password: form.password || undefined,
        importanceLevel: form.importanceLevel,
        endOfSupportDate: form.endOfSupportDate || null,
        upgradeRecommendations: form.upgradeRecommendations || null,
        conferenceRoomId: form.conferenceRoomId ? Number(form.conferenceRoomId) : null,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="hardware-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-grid">
        <div className="form-field">
          <label className="required">Manufacturer</label>
          <input value={form.manufacturer} onChange={set('manufacturer')} placeholder="Crestron" />
        </div>
        <div className="form-field">
          <label className="required">Model</label>
          <input value={form.model} onChange={set('model')} placeholder="DM-NVX-363" />
        </div>
        <div className="form-field full-width">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} placeholder="Primary video encoder" />
        </div>
        <div className="form-field">
          <label>Est. Replacement Cost ($)</label>
          <input type="number" min="0" step="0.01" value={form.estimatedReplacementCost} onChange={set('estimatedReplacementCost')} />
        </div>
        <div className="form-field">
          <label className="required">Importance</label>
          <select value={form.importanceLevel} onChange={set('importanceLevel')}>
            {IMPORTANCE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>MAC Address</label>
          <input value={form.macAddress} onChange={set('macAddress')} placeholder="00:1A:2B:3C:4D:5E" />
        </div>
        <div className="form-field">
          <label>IP Address</label>
          <input value={form.ipAddress} onChange={set('ipAddress')} placeholder="192.168.1.100" />
        </div>
        <div className="form-field">
          <label>Serial #</label>
          <input value={form.serialNumber} onChange={set('serialNumber')} />
        </div>
        <div className="form-field">
          <label>Software Version</label>
          <input value={form.softwareVersion} onChange={set('softwareVersion')} />
        </div>
        <div className="form-field">
          <label>Username</label>
          <input value={form.username} onChange={set('username')} autoComplete="off" />
        </div>
        <div className="form-field">
          <label>Password {initial?.has_password && '(leave blank to keep current)'}</label>
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        <div className="form-field">
          <label>End of Support Date</label>
          <input type="date" value={form.endOfSupportDate} onChange={set('endOfSupportDate')} />
        </div>
        {rooms.length > 0 && (
          <div className="form-field">
            <label>Conference Room</label>
            <select value={form.conferenceRoomId} onChange={set('conferenceRoomId')}>
              <option value="">Unassigned</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.office_name} — {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field full-width">
          <label>Upgrade Recommendations</label>
          <textarea value={form.upgradeRecommendations} onChange={set('upgradeRecommendations')} placeholder="Replace with NVX-384 when budget allows" />
        </div>
      </div>
    </form>
  );
}
