import { useState } from 'react';

const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'];

export default function HardwareBulkEdit({ selectedCount, rooms, onClose, onComplete }) {
  const [applyImportance, setApplyImportance] = useState(false);
  const [importanceLevel, setImportanceLevel] = useState('medium');
  const [applyEos, setApplyEos] = useState(false);
  const [clearEos, setClearEos] = useState(false);
  const [endOfSupportDate, setEndOfSupportDate] = useState('');
  const [applyWarranty, setApplyWarranty] = useState(false);
  const [clearWarranty, setClearWarranty] = useState(false);
  const [endOfWarrantyDate, setEndOfWarrantyDate] = useState('');
  const [applyRecommendedReplacement, setApplyRecommendedReplacement] = useState(false);
  const [clearRecommendedReplacement, setClearRecommendedReplacement] = useState(false);
  const [recommendedReplacementDate, setRecommendedReplacementDate] = useState('');
  const [applyUpgradeNotes, setApplyUpgradeNotes] = useState(false);
  const [upgradeRecommendations, setUpgradeRecommendations] = useState('');
  const [applyCost, setApplyCost] = useState(false);
  const [estimatedReplacementCost, setEstimatedReplacementCost] = useState('');
  const [applyRoom, setApplyRoom] = useState(false);
  const [conferenceRoomId, setConferenceRoomId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const updates = {};

    if (applyImportance) updates.importanceLevel = importanceLevel;
    if (applyEos) {
      updates.endOfSupportDate = clearEos ? null : endOfSupportDate || null;
      if (!clearEos && !endOfSupportDate) {
        setError('Select an end of support date or choose to clear it');
        return;
      }
    }
    if (applyWarranty) {
      updates.endOfWarrantyDate = clearWarranty ? null : endOfWarrantyDate || null;
      if (!clearWarranty && !endOfWarrantyDate) {
        setError('Select an end of warranty date or choose to clear it');
        return;
      }
    }
    if (applyRecommendedReplacement) {
      updates.recommendedReplacementDate = clearRecommendedReplacement ? null : recommendedReplacementDate || null;
      if (!clearRecommendedReplacement && !recommendedReplacementDate) {
        setError('Select a recommended replacement date or choose to clear it');
        return;
      }
    }
    if (applyUpgradeNotes) updates.upgradeRecommendations = upgradeRecommendations;
    if (applyCost) {
      updates.estimatedReplacementCost =
        estimatedReplacementCost === '' ? null : Number(estimatedReplacementCost);
    }
    if (applyRoom) {
      updates.conferenceRoomId = conferenceRoomId ? Number(conferenceRoomId) : null;
    }

    if (Object.keys(updates).length === 0) {
      setError('Check at least one field to update');
      return;
    }

    setSaving(true);
    try {
      await onComplete(updates);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="hardware-bulk-edit-form" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}

      <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Update <strong>{selectedCount}</strong> selected device{selectedCount !== 1 ? 's' : ''}. Only checked
        fields will be changed; everything else stays as-is.
      </p>

      <div className="bulk-edit-fields">
        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyImportance} onChange={(e) => setApplyImportance(e.target.checked)} />
          <span className="bulk-edit-label">Importance</span>
          <select value={importanceLevel} disabled={!applyImportance} onChange={(e) => setImportanceLevel(e.target.value)}>
            {IMPORTANCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyEos} onChange={(e) => setApplyEos(e.target.checked)} />
          <span className="bulk-edit-label">End of Support Date</span>
          <input
            type="date"
            value={endOfSupportDate}
            disabled={!applyEos || clearEos}
            onChange={(e) => setEndOfSupportDate(e.target.value)}
          />
        </label>
        {applyEos && (
          <label className="bulk-edit-row bulk-edit-sub">
            <input type="checkbox" checked={clearEos} onChange={(e) => setClearEos(e.target.checked)} />
            <span className="bulk-edit-label">Clear EOS date</span>
          </label>
        )}

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyWarranty} onChange={(e) => setApplyWarranty(e.target.checked)} />
          <span className="bulk-edit-label">End of Warranty Date</span>
          <input
            type="date"
            value={endOfWarrantyDate}
            disabled={!applyWarranty || clearWarranty}
            onChange={(e) => setEndOfWarrantyDate(e.target.value)}
          />
        </label>
        {applyWarranty && (
          <label className="bulk-edit-row bulk-edit-sub">
            <input type="checkbox" checked={clearWarranty} onChange={(e) => setClearWarranty(e.target.checked)} />
            <span className="bulk-edit-label">Clear warranty date</span>
          </label>
        )}

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyRecommendedReplacement} onChange={(e) => setApplyRecommendedReplacement(e.target.checked)} />
          <span className="bulk-edit-label">Recommended Replacement Date</span>
          <input
            type="date"
            value={recommendedReplacementDate}
            disabled={!applyRecommendedReplacement || clearRecommendedReplacement}
            onChange={(e) => setRecommendedReplacementDate(e.target.value)}
          />
        </label>
        {applyRecommendedReplacement && (
          <label className="bulk-edit-row bulk-edit-sub">
            <input
              type="checkbox"
              checked={clearRecommendedReplacement}
              onChange={(e) => setClearRecommendedReplacement(e.target.checked)}
            />
            <span className="bulk-edit-label">Clear recommended replacement date</span>
          </label>
        )}

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyUpgradeNotes} onChange={(e) => setApplyUpgradeNotes(e.target.checked)} />
          <span className="bulk-edit-label">Upgrade Recommendations</span>
          <textarea
            value={upgradeRecommendations}
            disabled={!applyUpgradeNotes}
            onChange={(e) => setUpgradeRecommendations(e.target.value)}
            rows={2}
          />
        </label>

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyCost} onChange={(e) => setApplyCost(e.target.checked)} />
          <span className="bulk-edit-label">Est. Replacement Cost ($)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={estimatedReplacementCost}
            disabled={!applyCost}
            onChange={(e) => setEstimatedReplacementCost(e.target.value)}
          />
        </label>

        <label className="bulk-edit-row">
          <input type="checkbox" checked={applyRoom} onChange={(e) => setApplyRoom(e.target.checked)} />
          <span className="bulk-edit-label">Conference Room</span>
          <select
            value={conferenceRoomId}
            disabled={!applyRoom}
            onChange={(e) => setConferenceRoomId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.office_name} — {room.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="modal-footer" style={{ margin: '1.5rem -1.5rem -1.5rem', padding: '1rem 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Updating...' : `Update ${selectedCount} Device${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );
}
