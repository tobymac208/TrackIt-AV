import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import HardwareForm from '../components/HardwareForm';
import HardwareImport from '../components/HardwareImport';
import HardwareBulkEdit from '../components/HardwareBulkEdit';
import ImportanceBadge, { formatDate, formatCost, isEosSoon, isEosPast, isWarrantySoon, isWarrantyPast } from '../components/ImportanceBadge';
import Pagination from '../components/Pagination';
import SortableHeader from '../components/SortableHeader';
import { getPagination } from '../utils/pagination';
import { sortHardware, HARDWARE_SORT_COLUMNS } from '../utils/hardwareSort';
import { hardwareMatchesSearch } from '../utils/hardwareSearch';

const IMPORTANCE_LEVELS = ['', 'low', 'medium', 'high', 'critical'];

export default function Hardware() {
  const { isAdmin } = useAuth();
  const [hardware, setHardware] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');
  const [eosFilter, setEosFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('device');
  const [sortDir, setSortDir] = useState('asc');

  const load = () => {
    setLoading(true);
    const params = {};
    if (importanceFilter) params.importance = importanceFilter;
    if (eosFilter === 'soon') params.eosSoon = 'true';
    if (warrantyFilter === 'expired') params.warrantyExpired = 'true';

    Promise.all([api.getHardware(params), api.getRooms()])
      .then(([hw, rm]) => {
        setHardware(hw);
        setRooms(rm);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [importanceFilter, eosFilter, warrantyFilter]);

  const filtered = hardware.filter((item) => hardwareMatchesSearch(item, search));

  const sorted = sortHardware(filtered, sortKey, sortDir);
  const { paginatedItems, totalPages, safePage, startIndex } = getPagination(sorted, page);

  useEffect(() => {
    setPage(1);
  }, [search, importanceFilter, eosFilter, warrantyFilter, hardware.length, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allFilteredSelected =
    sorted.length > 0 && sorted.every((item) => selectedIds.has(item.id));
  const selectedCount = selectedIds.size;

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        sorted.forEach((item) => next.delete(item.id));
      } else {
        sorted.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    if (!window.confirm(`Delete ${selectedCount} selected device${selectedCount !== 1 ? 's' : ''}?`)) return;

    setDeleting(true);
    setError('');
    try {
      await api.deleteHardwareBulk([...selectedIds]);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkEdit = async (updates) => {
    await api.bulkUpdateHardware([...selectedIds], updates);
    setShowBulkEdit(false);
    setSelectedIds(new Set());
    load();
  };

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
    if (isWarrantyPast(item.end_of_warranty_date)) return 'eos-past';
    if (isWarrantySoon(item.end_of_warranty_date)) return 'eos-soon';
    return '';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Hardware Inventory</h2>
          <p>
            {filtered.length} device{filtered.length !== 1 ? 's' : ''} listed
            {filtered.length !== hardware.length && ` (of ${hardware.length} total)`}
          </p>
        </div>
        {isAdmin && (
          <div className="actions">
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              Import CSV
            </button>
            <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
              Add Hardware
            </button>
          </div>
        )}
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search device name, serial, IP, location..."
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
        <label htmlFor="warranty-filter">Warranty:</label>
        <select id="warranty-filter" value={warrantyFilter} onChange={(e) => setWarrantyFilter(e.target.value)}>
          <option value="">All</option>
          <option value="expired">Expired</option>
        </select>
        {isAdmin && selectedCount > 0 && (
          <>
            <span className="selection-count">{selectedCount} selected</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkEdit(true)} disabled={deleting}>
              Edit Selected
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())} disabled={deleting}>
              Clear Selection
            </button>
          </>
        )}
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
                  {isAdmin && (
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible devices"
                        title="Select all visible"
                      />
                    </th>
                  )}
                  <th className="col-num">#</th>
                  {HARDWARE_SORT_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      label={column.label}
                      sortKey={column.key}
                      activeSort={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                  <th>Credentials</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, index) => (
                  <tr key={item.id} className={`${rowClass(item)}${isAdmin && selectedIds.has(item.id) ? ' row-selected' : ''}`}>
                    {isAdmin && (
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.manufacturer} ${item.model}`}
                        />
                      </td>
                    )}
                    <td className="col-num">{startIndex + index + 1}</td>
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
                    <td>{formatDate(item.end_of_warranty_date)}</td>
                    <td>{formatCost(item.estimated_replacement_cost)}</td>
                    <td>
                      {item.username && <div style={{ fontSize: '0.8rem' }}>{item.username}</div>}
                      {item.has_password ? (
                        isAdmin ? (
                          revealedPasswords[item.id] ? (
                            <code style={{ fontSize: '0.75rem' }}>{revealedPasswords[item.id]}</code>
                          ) : (
                            <button className="btn-link" onClick={() => revealPassword(item.id)}>
                              Reveal password
                            </button>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Hidden</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    {isAdmin && (
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
            totalItems={sorted.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {showBulkEdit && (
        <Modal title="Bulk Edit Hardware" onClose={() => setShowBulkEdit(false)}>
          <HardwareBulkEdit
            selectedCount={selectedCount}
            rooms={rooms}
            onClose={() => setShowBulkEdit(false)}
            onComplete={handleBulkEdit}
          />
        </Modal>
      )}

      {showImport && (
        <Modal title="Import Hardware from CSV" onClose={() => setShowImport(false)}>
          <HardwareImport onClose={() => setShowImport(false)} onComplete={load} />
        </Modal>
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
