import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import JobSiteForm from '../components/JobSiteForm';
import RoomStatusBadge from '../components/RoomStatusBadge';
import Pagination from '../components/Pagination';
import { getPagination } from '../utils/pagination';
import { buildJobSiteName, isJobSiteName, jobSiteCodeName, parseJobSiteName } from '../utils/jobSite';

export default function JobSites() {
  const { can } = useAuth();
  const canWrite = can('rooms', 'write');
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);

  const jobSites = rooms.filter((room) => isJobSiteName(room.name));
  const { paginatedItems, totalPages, safePage, startIndex } = getPagination(jobSites, page);

  useEffect(() => {
    setPage(1);
  }, [jobSites.length]);

  const load = () => {
    setLoading(true);
    api
      .getRooms()
      .then(setRooms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (data) => {
    await api.createJobSite(data);
    setModal(null);
    load();
  };

  const handleUpdate = async (data) => {
    const name = buildJobSiteName(data.state, data.roomName);
    await api.updateRoom(modal.id, {
      name,
      officeId: modal.office_id,
      status: data.status,
      issueDescription: data.issueDescription,
    });
    setModal(null);
    load();
  };

  const handleDelete = async (room) => {
    if (!window.confirm(`Delete job site "${room.name}"? Hardware will be unassigned.`)) return;
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
          <h2>Job Sites</h2>
          <p>
            {jobSites.length} job site{jobSites.length !== 1 ? 's' : ''} listed
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            Add Job Site
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading job sites...</div>
      ) : jobSites.length === 0 ? (
        <div className="empty-state">
          No job sites yet. Add one to create a room named like Conf-JOB-GA-Benning.
        </div>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Room Name</th>
                  <th>Job Site</th>
                  <th>Status</th>
                  <th>Hardware</th>
                  {canWrite && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((room, index) => {
                  const parsed = parseJobSiteName(room.name);
                  return (
                    <tr key={room.id} className="clickable" onClick={() => navigate(`/rooms/${room.id}`)}>
                      <td className="col-num">{startIndex + index + 1}</td>
                      <td>{parsed?.roomName || room.name}</td>
                      <td>{jobSiteCodeName(parsed?.state)}</td>
                      <td>
                        <RoomStatusBadge status={room.status} />
                        {room.status === 'issue' && room.issue_description && (
                          <div className="room-issue-preview">{room.issue_description}</div>
                        )}
                      </td>
                      <td>{room.hardware_count}</td>
                      {canWrite && (
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
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={jobSites.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Add Job Site' : 'Edit Job Site'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="job-site-form">
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </>
          }
        >
          <JobSiteForm
            initial={modal.mode === 'edit' ? modal : null}
            onSubmit={modal.mode === 'create' ? handleCreate : handleUpdate}
          />
        </Modal>
      )}
    </div>
  );
}
