import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import HardwareForm from '../components/HardwareForm';
import ImportanceBadge, { formatDate, formatCost } from '../components/ImportanceBadge';
import { getHardwareRowClass } from '../utils/replacementReview';
import RoomStatusBadge from '../components/RoomStatusBadge';

export default function RoomDetail() {
  const { can } = useAuth();
  const canWrite = can('hardware', 'write');
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [hardware, setHardware] = useState([]);
  const [assignable, setAssignable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignId, setAssignId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.getRoom(id), api.getRoomHardware(id), api.getHardware()])
      .then(([rm, hw, allHw]) => {
        setRoom(rm);
        setHardware(hw);
        const inRoom = new Set(hw.map((item) => item.id));
        setAssignable(allHw.filter((item) => !inRoom.has(item.id)));
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
      await api.assignHardware(item.id, null, { fromRoomId: Number(id) });
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
            {room.office_name} &middot; <RoomStatusBadge status={room.status} /> &middot; {hardware.length}{' '}
            hardware item{hardware.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create Hardware for Room
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {room.status === 'issue' && room.issue_description && (
        <div className="room-issue-note">
          <strong>Issue</strong>
          <p>{room.issue_description}</p>
        </div>
      )}

      {canWrite && assignable.length > 0 && (
        <div className="filters" style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="assign-hardware">Add existing hardware:</label>
          <select id="assign-hardware" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
            <option value="">Select hardware...</option>
            {assignable.map((h) => (
              <option key={h.id} value={h.id}>
                {h.manufacturer} {h.model}
                {h.rooms?.length ? ` (${h.rooms.length} room${h.rooms.length === 1 ? '' : 's'})` : ''}
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
                  <th>Warranty</th>
                  <th>Replace By</th>
                  <th>Est. Cost</th>
                  {canWrite && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {hardware.map((item) => (
                  <tr key={item.id} className={getHardwareRowClass(item)}>
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
                    <td>{formatDate(item.end_of_warranty_date)}</td>
                    <td>{formatDate(item.recommended_replacement_date)}</td>
                    <td>{formatCost(item.estimated_replacement_cost)}</td>
                    {canWrite && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleUnassign(item)}>
                          Remove
                        </button>
                      </td>
                    )}
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
