import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Modal from '../components/Modal';
import RoomForm from '../components/RoomForm';

export default function Rooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [offices, setOffices] = useState([]);
  const [officeFilter, setOfficeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getRooms(officeFilter || undefined), api.getOffices()])
      .then(([rm, off]) => {
        setRooms(rm);
        setOffices(off);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [officeFilter]);

  const handleCreate = async (data) => {
    await api.createRoom(data);
    setModal(null);
    load();
  };

  const handleUpdate = async (data) => {
    await api.updateRoom(modal.id, data);
    setModal(null);
    load();
  };

  const handleDelete = async (room) => {
    if (!window.confirm(`Delete room "${room.name}"? Hardware will be unassigned.`)) return;
    try {
      await api.deleteRoom(room.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Conference Rooms</h2>
          <p>Manage rooms and their assigned hardware</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: 'create' })}
          disabled={offices.length === 0}
        >
          Add Room
        </button>
      </div>

      <div className="filters">
        <label htmlFor="office-filter">Filter by office:</label>
        <select id="office-filter" value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)}>
          <option value="">All offices</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {offices.length === 0 && !loading && (
        <div className="error-banner">Create an office before adding conference rooms.</div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">No conference rooms found.</div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room Name</th>
                  <th>Office</th>
                  <th>Hardware</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="clickable" onClick={() => navigate(`/rooms/${room.id}`)}>
                    <td>{room.name}</td>
                    <td>{room.office_name}</td>
                    <td>{room.hardware_count}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', ...room })}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(room)}>
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
          title={modal.mode === 'create' ? 'Add Conference Room' : 'Edit Conference Room'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="room-form">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          <RoomForm
            initial={modal.mode === 'edit' ? modal : null}
            offices={offices}
            onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
