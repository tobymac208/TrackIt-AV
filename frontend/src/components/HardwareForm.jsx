import { useState } from 'react';
import { formatMacAddress, normalizeMacAddress } from '../utils/macAddress';

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
  endOfWarrantyDate: '',
  recommendedReplacementDate: '',
  upgradeRecommendations: '',
  conferenceRoomIds: [],
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
          macAddress: formatMacAddress(initial.mac_address || ''),
          ipAddress: initial.ip_address || '',
          serialNumber: initial.serial_number || '',
          softwareVersion: initial.software_version || '',
          username: initial.username || '',
          password: '',
          importanceLevel: initial.importance_level || 'medium',
          endOfSupportDate: initial.end_of_support_date || '',
          endOfWarrantyDate: initial.end_of_warranty_date || '',
          recommendedReplacementDate: initial.recommended_replacement_date || '',
          upgradeRecommendations: initial.upgrade_recommendations || '',
          conferenceRoomIds: initial.rooms?.length
            ? initial.rooms.map((room) => room.id)
            : initial.conference_room_id
              ? [initial.conference_room_id]
              : [],
        }
      : {}),
  }));
  const [error, setError] = useState('');
  const [roomFilter, setRoomFilter] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleMacChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, macAddress: formatMacAddress(value) || value }));
  };

  const handleMacBlur = () => {
    setForm((f) => ({ ...f, macAddress: formatMacAddress(f.macAddress) || f.macAddress }));
  };

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
        macAddress: normalizeMacAddress(form.macAddress),
        ipAddress: form.ipAddress || null,
        serialNumber: form.serialNumber || null,
        softwareVersion: form.softwareVersion || null,
        username: form.username || null,
        password: form.password || undefined,
        importanceLevel: form.importanceLevel,
        endOfSupportDate: form.endOfSupportDate || null,
        endOfWarrantyDate: form.endOfWarrantyDate || null,
        recommendedReplacementDate: form.recommendedReplacementDate || null,
        upgradeRecommendations: form.upgradeRecommendations || null,
        ...(rooms.length > 0 ? { conferenceRoomIds: form.conferenceRoomIds } : {}),
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
          <input
            value={form.macAddress}
            onChange={handleMacChange}
            onBlur={handleMacBlur}
            placeholder="00:1a:2b:3c:4d:5e"
          />
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
        <div className="form-field">
          <label>End of Warranty Date</label>
          <input type="date" value={form.endOfWarrantyDate} onChange={set('endOfWarrantyDate')} />
        </div>
        <div className="form-field">
          <label>Recommended Replacement Date</label>
          <input type="date" value={form.recommendedReplacementDate} onChange={set('recommendedReplacementDate')} />
          <p className="room-checklist-hint">
            Optional manufacturer replace-by date. When set, this overrides EOS and warranty for upgrade priority.
          </p>
        </div>
        {rooms.length > 0 && (
          <div className="form-field full-width">
            <label>Conference Rooms</label>
            <p className="room-checklist-hint">
              Check every room this hardware should appear in. Use this for generic gear (retractors, switchers,
              extenders) that is the same in many rooms.
            </p>
            <input
              type="search"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder="Filter rooms..."
              className="room-checklist-filter"
            />
            <div className="room-checklist">
              {rooms
                .filter((r) => {
                  const q = roomFilter.trim().toLowerCase();
                  if (!q) return true;
                  return `${r.office_name} ${r.name}`.toLowerCase().includes(q);
                })
                .map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      checked={form.conferenceRoomIds.map(Number).includes(Number(r.id))}
                      onChange={() => {
                        setForm((f) => {
                          const id = Number(r.id);
                          const selected = f.conferenceRoomIds.map(Number);
                          const has = selected.includes(id);
                          return {
                            ...f,
                            conferenceRoomIds: has ? selected.filter((roomId) => roomId !== id) : [...selected, id],
                          };
                        });
                      }}
                    />
                    {r.office_name} — {r.name}
                  </label>
                ))}
            </div>
            <div className="room-checklist-count">
              {form.conferenceRoomIds.length === 0
                ? 'Unassigned'
                : `${form.conferenceRoomIds.length} room${form.conferenceRoomIds.length === 1 ? '' : 's'} selected`}
            </div>
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
