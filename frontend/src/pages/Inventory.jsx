import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import InventoryForm from '../components/InventoryForm';
import Pagination from '../components/Pagination';
import { getPagination } from '../utils/pagination';

export default function Inventory() {
  const { can } = useAuth();
  const canWrite = can('inventory', 'write');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);

  const { paginatedItems, totalPages, safePage, startIndex } = getPagination(items, page);
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  useEffect(() => {
    setPage(1);
  }, [items.length]);

  const load = () => {
    setLoading(true);
    api
      .getInventory()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (data) => {
    await api.createInventory(data);
    setModal(null);
    load();
  };

  const handleUpdate = async (data) => {
    await api.updateInventory(modal.id, data);
    setModal(null);
    load();
  };

  const handleQuantity = async (item, delta) => {
    const next = item.quantity + delta;
    if (next < 0) return;
    setError('');
    try {
      await api.updateInventoryQuantity(item.id, next);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove "${item.manufacturer} ${item.model}" from shelf stock?`)) return;
    try {
      await api.deleteInventory(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Inventory</h2>
          <p>
            {items.length} shelf stock item{items.length !== 1 ? 's' : ''}
            {items.length > 0 && ` · ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} on hand`}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            Add Shelf Stock
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading inventory...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          No shelf stock yet. Add transmitters, Room Navigators, or other gear that is ready to deploy.
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Device</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Notes</th>
                  {canWrite && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, index) => (
                  <tr key={item.id}>
                    <td className="col-num">{startIndex + index + 1}</td>
                    <td>
                      <strong>
                        {item.manufacturer} {item.model}
                      </strong>
                    </td>
                    <td>
                      {canWrite ? (
                        <div className="qty-stepper">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleQuantity(item, -1)}
                            disabled={item.quantity <= 0}
                            aria-label={`Decrease ${item.manufacturer} ${item.model} quantity`}
                          >
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleQuantity(item, 1)}
                            aria-label={`Increase ${item.manufacturer} ${item.model} quantity`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td>{item.location || '—'}</td>
                    <td>{item.notes || '—'}</td>
                    {canWrite && (
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
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={items.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Add Shelf Stock' : 'Edit Shelf Stock'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="inventory-form">
                {modal.mode === 'create' ? 'Add' : 'Save'}
              </button>
            </>
          }
        >
          <InventoryForm
            initial={modal.mode === 'edit' ? modal : null}
            onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
          />
        </Modal>
      )}
    </div>
  );
}
