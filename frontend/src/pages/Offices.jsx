import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import OfficeForm from '../components/OfficeForm';
import Pagination from '../components/Pagination';
import { getPagination } from '../utils/pagination';

export default function Offices() {
  const { can } = useAuth();
  const canWrite = can('offices', 'write');
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);

  const { paginatedItems, totalPages, safePage, startIndex } = getPagination(offices, page);

  useEffect(() => {
    setPage(1);
  }, [offices.length]);

  const load = () => {
    setLoading(true);
    api
      .getOffices()
      .then(setOffices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (data) => {
    await api.createOffice(data);
    setModal(null);
    load();
  };

  const handleUpdate = async (data) => {
    await api.updateOffice(modal.id, data);
    setModal(null);
    load();
  };

  const handleDelete = async (office) => {
    if (!window.confirm(`Delete office "${office.name}"? Rooms will be removed and hardware unassigned.`)) return;
    try {
      await api.deleteOffice(office.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Offices</h2>
          <p>{offices.length} office{offices.length !== 1 ? 's' : ''} listed</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            Add Office
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading offices...</div>
      ) : offices.length === 0 ? (
        <div className="empty-state">No offices yet. Create your first office to get started.</div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Name</th>
                  <th>Rooms</th>
                  <th>Created</th>
                  {canWrite && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((office, index) => (
                  <tr key={office.id}>
                    <td className="col-num">{startIndex + index + 1}</td>
                    <td>{office.name}</td>
                    <td>{office.room_count}</td>
                    <td>{new Date(office.created_at).toLocaleDateString()}</td>
                    {canWrite && (
                      <td>
                        <div className="actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', ...office })}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(office)}>
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
            totalItems={offices.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Add Office' : 'Edit Office'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="office-form">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          <OfficeForm
            initial={modal.mode === 'edit' ? modal : null}
            onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
