import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Modal from '../components/Modal';
import HardwareForm from '../components/HardwareForm';
import ImportanceBadge, { formatDate, formatCost } from '../components/ImportanceBadge';

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [hardware, setHardware] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignId, setAssignId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getRoom(id), api.getRoomHardware(id), api.getHardware({ unassigned: 'true' })])
      .then(([rm, hw, unassignedHw]) => {
        setRoom(rm);
        setHardware(hw);
        setUnassigned(unassignedHw);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleAssign = async () => {
    if (!assignId) return;
    try {
      await api.assignHardware(Number(assignId), Number(id));
      setAssignId('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnassign = async (item) => {
    if (!window.confirm(`Remove "${item.manufacturer} ${item.model}" from this room?`)) return;
    try {
      await api.assignHardware(item.id, null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreate = async (data) => {
    await api.createHardware({ ...data, conferenceRoomId: Number(id) });
    setShowCreate(false);
    load();
  };

  if (loading) return <div className="loading">Loading room...</div>;
  if (error && !room) return <div className="error-banner">{error}</div>;
  if (!room) return <div className="error-banner">Room not found</div>;

  return (
    <div>
      <Link to="/rooms" className="back-link">
        &larr; Back to Rooms
      </Link>

      <div className="page-header">
        <div>
          <h2>{room.name}</h2>
          <p>
            {room.office_name} &middot; {hardware.length} hardware item{hardware.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          Create Hardware for Room
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {unassigned.length > 0 && (
        <div className="filters" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="assign-hardware">Add existing hardware:</label>
          <select id="assign-hardware" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
            <option value="">Select unassigned hardware...</option>
            {unassigned.map((h) => (
              <option key={h.id} value={h.id}>
                {h.manufacturer} {h.model}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={handleAssign} disabled={!assignId}>
            Assign to Room
          </button>
        </div>
      )}

      {hardware.length === 0 ? (
        <div className="empty-state">No hardware assigned to this room yet.</div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Importance</th>
                  <th>IP Address</th>
                  <th>Serial #</th>
                  <th>EOS Date</th>
                  <th>Est. Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hardware.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.manufacturer} {item.model}
                      </strong>
                      {item.description && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.description}</div>
                      )}
                    </td>
                    <td>
                      <ImportanceBadge level={item.importance_level} />
                    </td>
                    <td>{item.ip_address || '—'}</td>
                    <td>{item.serial_number || '—'}</td>
                    <td>{formatDate(item.end_of_support_date)}</td>
                    <td>{formatCost(item.estimated_replacement_cost)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleUnassign(item)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal
          title={`Add Hardware to ${room.name}`}
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="hardware-form">
                Create
              </button>
            </>
          }
        >
          <HardwareForm onSubmit={handleCreate} />
        </Modal>
      )}
    </div>
  );
}
