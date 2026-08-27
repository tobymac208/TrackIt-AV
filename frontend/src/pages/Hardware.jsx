import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import HardwareForm from '../components/HardwareForm';
import ImportanceBadge, { formatDate, formatCost, isEosSoon, isEosPast } from '../components/ImportanceBadge';

const IMPORTANCE_LEVELS = ['', 'low', 'medium', 'high', 'critical'];

export default function Hardware() {
  const [hardware, setHardware] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');
  const [eosFilter, setEosFilter] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const load = () => {
    setLoading(true);
    const params = {};
    if (importanceFilter) params.importance = importanceFilter;
    if (eosFilter === 'soon') params.eosSoon = 'true';

    Promise.all([api.getHardware(params), api.getRooms()])
      .then(([hw, rm]) => {
        setHardware(hw);
        setRooms(rm);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [importanceFilter, eosFilter]);

  const filtered = hardware.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.manufacturer?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.ip_address?.toLowerCase().includes(q) ||
      item.office_name?.toLowerCase().includes(q) ||
      item.room_name?.toLowerCase().includes(q)
    );
  });

  const handleCreate = async (data) => {
    await api.createHardware(data);
    setModal(null);
    load();
  };

  const handleUpdate = async (data) => {
    await api.updateHardware(modal.id, data);
    setModal(null);
    load();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.manufacturer} ${item.model}"?`)) return;
    try {
      await api.deleteHardware(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const revealPassword = async (id) => {
    try {
      const item = await api.getHardwareItem(id, true);
      setRevealedPasswords((prev) => ({ ...prev, [id]: item.password || '(empty)' }));
    } catch (err) {
      setError(err.message);
    }
  };

  const rowClass = (item) => {
    if (isEosPast(item.end_of_support_date)) return 'eos-past';
    if (isEosSoon(item.end_of_support_date)) return 'eos-soon';
    return '';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Hardware Inventory</h2>
          <p>Manage all AV hardware across your organization</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          Add Hardware
        </button>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search manufacturer, model, serial, IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '260px' }}
        />
        <label htmlFor="importance-filter">Importance:</label>
        <select id="importance-filter" value={importanceFilter} onChange={(e) => setImportanceFilter(e.target.value)}>
          {IMPORTANCE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l ? l.charAt(0).toUpperCase() + l.slice(1) : 'All'}
            </option>
          ))}
        </select>
        <label htmlFor="eos-filter">EOS:</label>
        <select id="eos-filter" value={eosFilter} onChange={(e) => setEosFilter(e.target.value)}>
          <option value="">All</option>
          <option value="soon">Within 90 days</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading hardware...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No hardware found.</div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Location</th>
                  <th>Importance</th>
                  <th>IP</th>
                  <th>Serial #</th>
                  <th>EOS Date</th>
                  <th>Est. Cost</th>
                  <th>Credentials</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className={rowClass(item)}>
                    <td>
                      <strong>
                        {item.manufacturer} {item.model}
                      </strong>
                      {item.description && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.description}</div>
                      )}
                    </td>
                    <td>{item.room_name ? `${item.office_name} — ${item.room_name}` : 'Unassigned'}</td>
                    <td>
                      <ImportanceBadge level={item.importance_level} />
                    </td>
                    <td>{item.ip_address || '—'}</td>
                    <td>{item.serial_number || '—'}</td>
                    <td>{formatDate(item.end_of_support_date)}</td>
                    <td>{formatCost(item.estimated_replacement_cost)}</td>
                    <td>
                      {item.username && <div style={{ fontSize: '0.8rem' }}>{item.username}</div>}
                      {item.has_password ? (
                        revealedPasswords[item.id] ? (
                          <code style={{ fontSize: '0.75rem' }}>{revealedPasswords[item.id]}</code>
                        ) : (
                          <button className="btn-link" onClick={() => revealPassword(item.id)}>
                            Reveal password
                          </button>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', ...item })}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Add Hardware' : 'Edit Hardware'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="hardware-form">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          <HardwareForm
            initial={modal.mode === 'edit' ? modal : null}
            rooms={rooms}
            onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
          />
        </Modal>
      )}
    </div>
  );
}
