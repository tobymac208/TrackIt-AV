import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import ImportanceBadge, { formatDate, isEosSoon, isEosPast } from '../components/ImportanceBadge';

export default function Dashboard() {
  const [hardware, setHardware] = useState([]);
  const [offices, setOffices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getHardware(), api.getOffices(), api.getRooms()])
      .then(([hw, off, rm]) => {
        setHardware(hw);
        setOffices(off);
        setRooms(rm);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error-banner">{error}</div>;

  const unassigned = hardware.filter((h) => !h.conference_room_id).length;
  const eosSoon = hardware.filter((h) => isEosSoon(h.end_of_support_date));
  const eosPast = hardware.filter((h) => isEosPast(h.end_of_support_date));

  const byImportance = {
    critical: hardware.filter((h) => h.importance_level === 'critical').length,
    high: hardware.filter((h) => h.importance_level === 'high').length,
    medium: hardware.filter((h) => h.importance_level === 'medium').length,
    low: hardware.filter((h) => h.importance_level === 'low').length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your AV hardware inventory</p>
        </div>
        <div className="actions">
          <Link to="/hardware" className="btn btn-primary">
            Add Hardware
          </Link>
        </div>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Total Hardware</div>
          <div className="value">{hardware.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Offices</div>
          <div className="value">{offices.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Conference Rooms</div>
          <div className="value">{rooms.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Unassigned</div>
          <div className="value">{unassigned}</div>
        </div>
        <div className="stat-card">
          <div className="label">EOS Within 90 Days</div>
          <div className="value" style={{ color: eosSoon.length ? '#ca8a04' : undefined }}>
            {eosSoon.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Past EOS</div>
          <div className="value" style={{ color: eosPast.length ? '#dc2626' : undefined }}>
            {eosPast.length}
          </div>
        </div>
      </div>

      <div className="card-grid">
        {Object.entries(byImportance).map(([level, count]) => (
          <div className="stat-card" key={level}>
            <div className="label">{level} Importance</div>
            <div className="value" style={{ fontSize: '1.5rem' }}>
              <ImportanceBadge level={level} /> {count}
            </div>
          </div>
        ))}
      </div>

      {(eosSoon.length > 0 || eosPast.length > 0) && (
        <div className="panel">
          <div className="panel-header">End of Support Alerts</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Location</th>
                  <th>Importance</th>
                  <th>EOS Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...eosPast, ...eosSoon].map((item) => (
                  <tr key={item.id} className={isEosPast(item.end_of_support_date) ? 'eos-past' : 'eos-soon'}>
                    <td>
                      {item.manufacturer} {item.model}
                    </td>
                    <td>
                      {item.room_name ? `${item.office_name} — ${item.room_name}` : 'Unassigned'}
                    </td>
                    <td>
                      <ImportanceBadge level={item.importance_level} />
                    </td>
                    <td>{formatDate(item.end_of_support_date)}</td>
                    <td>{isEosPast(item.end_of_support_date) ? 'Past due' : 'Within 90 days'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
