import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import RoomForm from '../components/RoomForm';
import RoomStatusBadge from '../components/RoomStatusBadge';
import Pagination from '../components/Pagination';
import { getPagination } from '../utils/pagination';

export default function Rooms() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [offices, setOffices] = useState([]);
  const [officeFilter, setOfficeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);

  const { paginatedItems, totalPages, safePage, startIndex } = getPagination(rooms, page);

  useEffect(() => {
    setPage(1);
  }, [officeFilter, rooms.length]);

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
          <p>{rooms.length} room{rooms.length !== 1 ? 's' : ''} listed</p>
        </div>
        {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
            disabled={offices.length === 0}
          >
            Add Room
          </button>
        )}
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

      {isAdmin && offices.length === 0 && !loading && (
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
                  <th className="col-num">#</th>
                  <th>Room Name</th>
                  <th>Office</th>
                  <th>Status</th>
                  <th>Hardware</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((room, index) => (
                  <tr key={room.id} className="clickable" onClick={() => navigate(`/rooms/${room.id}`)}>
                    <td className="col-num">{startIndex + index + 1}</td>
                    <td>{room.name}</td>
                    <td>{room.office_name}</td>
                    <td>
                      <RoomStatusBadge status={room.status} />
                    </td>
                    <td>{room.hardware_count}</td>
                    {isAdmin && (
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={rooms.length}
            onPageChange={setPage}
          />
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
