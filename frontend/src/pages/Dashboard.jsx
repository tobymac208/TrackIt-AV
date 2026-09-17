import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import ImportanceBadge, { formatDate, formatCost, isDatePast, isDateSoon, isEosSoon, isEosPast, isWarrantyPast } from '../components/ImportanceBadge';
import Pagination from '../components/Pagination';
import { getPagination } from '../utils/pagination';
import {
  REPLACEMENT_CRITERIA,
  REPLACEMENT_LEAD_TIME,
  buildReplacementReview,
} from '../utils/replacementReview';
import { formatHardwareLocation } from '../utils/hardwareSort';

export default function Dashboard() {
  const { can } = useAuth();
  const canWriteHardware = can('hardware', 'write');
  const [hardware, setHardware] = useState([]);
  const [offices, setOffices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllAnnual, setShowAllAnnual] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [eosAlertsPage, setEosAlertsPage] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [eosOpen, setEosOpen] = useState(true);

  useEffect(() => {
    Promise.all([
      can('hardware', 'read') ? api.getHardware() : Promise.resolve([]),
      can('offices', 'read') ? api.getOffices() : Promise.resolve([]),
      can('rooms', 'read') ? api.getRooms() : Promise.resolve([]),
    ])
      .then(([hw, off, rm]) => {
        setHardware(hw);
        setOffices(off);
        setRooms(rm);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setReviewPage(1);
  }, [showAllAnnual]);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error-banner">{error}</div>;

  const unassigned = hardware.filter((h) => !(h.rooms?.length || h.conference_room_id)).length;
  const eosSoon = hardware.filter((h) => !h.recommended_replacement_date && isEosSoon(h.end_of_support_date));
  const eosPast = hardware.filter((h) => !h.recommended_replacement_date && isEosPast(h.end_of_support_date));
  const warrantyExpired = hardware.filter((h) => !h.recommended_replacement_date && isWarrantyPast(h.end_of_warranty_date));
  const recommendedPast = hardware.filter((h) => isDatePast(h.recommended_replacement_date));
  const recommendedSoon = hardware.filter((h) => isDateSoon(h.recommended_replacement_date));

  const byImportance = {
    critical: hardware.filter((h) => h.importance_level === 'critical').length,
    high: hardware.filter((h) => h.importance_level === 'high').length,
    medium: hardware.filter((h) => h.importance_level === 'medium').length,
    low: hardware.filter((h) => h.importance_level === 'low').length,
  };

  const review = buildReplacementReview(hardware);
  const displayItems = showAllAnnual ? review.annualItems : review.priorityItems;
  const {
    paginatedItems: reviewPaginatedItems,
    totalPages: reviewTotalPages,
    safePage: reviewSafePage,
    startIndex: reviewStartIndex,
  } = getPagination(displayItems, reviewPage);

  const eosAlerts = [...eosPast, ...eosSoon];
  const {
    paginatedItems: eosPaginatedItems,
    totalPages: eosTotalPages,
    safePage: eosSafePage,
  } = getPagination(eosAlerts, eosAlertsPage);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your AV hardware inventory</p>
        </div>
        {canWriteHardware && (
          <div className="actions">
            <Link to="/hardware" className="btn btn-primary">
              Add Hardware
            </Link>
          </div>
        )}
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
          <div className="value" style={{ color: eosSoon.length ? 'var(--medium)' : undefined }}>
            {eosSoon.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Past EOS</div>
          <div className="value" style={{ color: eosPast.length ? 'var(--danger)' : undefined }}>
            {eosPast.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Warranty Expired</div>
          <div className="value" style={{ color: warrantyExpired.length ? 'var(--danger)' : undefined }}>
            {warrantyExpired.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Replace By Within 90 Days</div>
          <div className="value" style={{ color: recommendedSoon.length ? 'var(--medium)' : undefined }}>
            {recommendedSoon.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Past Recommended Replacement</div>
          <div className="value" style={{ color: recommendedPast.length ? 'var(--danger)' : undefined }}>
            {recommendedPast.length}
          </div>
        </div>
      </div>

      <div className="panel replacement-review-panel">
        <button
          type="button"
          className="panel-header panel-header-toggle"
          aria-expanded={reviewOpen}
          onClick={() => setReviewOpen((open) => !open)}
        >
          <span>Annual Replacement Review</span>
          <span className="panel-header-meta">
            {displayItems.length} {displayItems.length === 1 ? 'device' : 'devices'}
            <span className="collapse-chevron" aria-hidden="true">
              ▾
            </span>
          </span>
        </button>
        <div className="replacement-review-intro">
          <p>
            Presentation view for <strong>Critical</strong> and <strong>High</strong> importance hardware.
            Priority items are past recommended replacement, recommended replacement within 90 days, past EOS,
            EOS within 90 days, out of warranty (Critical/High), or have a replacement recommendation on file.
            A manufacturer recommended replacement date overrides EOS and warranty.
          </p>
          <div className="criteria-grid">
            {Object.entries(REPLACEMENT_CRITERIA).map(([level, text]) => (
              <div key={level} className="criteria-item">
                <ImportanceBadge level={level} />
                <span>{text}</span>
              </div>
            ))}
          </div>
          <p className="replacement-note">
            Critical and High items should include a recommendation, ~{REPLACEMENT_LEAD_TIME} lead time, and
            estimated cost when presenting to the business. Out-of-warranty Critical/High hardware is flagged
            as a priority replacement.
          </p>
        </div>

        <div className="card-grid replacement-stats">
          <div className="stat-card">
            <div className="label">Priority Replacements</div>
            <div className="value">{review.priorityItems.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Critical (Annual List)</div>
            <div className="value">{review.criticalCount}</div>
          </div>
          <div className="stat-card">
            <div className="label">High (Annual List)</div>
            <div className="value">{review.highCount}</div>
          </div>
          <div className="stat-card">
            <div className="label">Out of Warranty (Critical/High)</div>
            <div className="value">{review.outOfWarrantyCount}</div>
          </div>
          <div className="stat-card">
            <div className="label">Priority Est. Cost</div>
            <div className="value" style={{ fontSize: '1.25rem' }}>
              {formatCost(review.priorityEstimatedCost)}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">All Critical/High Est. Cost</div>
            <div className="value" style={{ fontSize: '1.25rem' }}>
              {formatCost(review.totalEstimatedCost)}
            </div>
          </div>
        </div>

        {reviewOpen && (
          <>
            <div className="filters" style={{ padding: '0 1.25rem 1rem' }}>
              <label>
                <input
                  type="checkbox"
                  checked={showAllAnnual}
                  onChange={(e) => setShowAllAnnual(e.target.checked)}
                />{' '}
                Show all Critical &amp; High hardware (full annual inventory)
              </label>
            </div>

            {displayItems.length === 0 ? (
              <div className="empty-state">
                No {showAllAnnual ? 'Critical or High' : 'priority replacement'} hardware found.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-num">#</th>
                      <th>Device</th>
                      <th>Location</th>
                      <th>Importance</th>
                      <th>Status</th>
                      <th>EOS Date</th>
                      <th>Warranty</th>
                      <th>Replace By</th>
                      <th>Recommendation</th>
                      <th>Est. Cost</th>
                      <th>Lead Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewPaginatedItems.map((item, index) => (
                      <tr key={item.id} className={item.replacementStatus.rowClass}>
                        <td className="col-num">{reviewStartIndex + index + 1}</td>
                        <td>
                          <strong>
                            {item.manufacturer} {item.model}
                          </strong>
                        </td>
                        <td>{formatHardwareLocation(item)}</td>
                        <td>
                          <ImportanceBadge level={item.importance_level} />
                        </td>
                        <td>{item.replacementStatus.label}</td>
                        <td>{formatDate(item.end_of_support_date)}</td>
                        <td>{formatDate(item.end_of_warranty_date)}</td>
                        <td>{formatDate(item.recommended_replacement_date)}</td>
                        <td style={{ maxWidth: '280px' }}>{item.recommendation}</td>
                        <td>{formatCost(item.estimated_replacement_cost)}</td>
                        <td>{REPLACEMENT_LEAD_TIME}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {displayItems.length > 0 && (
              <Pagination
                page={reviewSafePage}
                totalPages={reviewTotalPages}
                totalItems={displayItems.length}
                onPageChange={setReviewPage}
              />
            )}
          </>
        )}
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
        <div className={`panel${eosOpen ? '' : ' panel-collapsed'}`}>
          <button
            type="button"
            className="panel-header panel-header-toggle"
            aria-expanded={eosOpen}
            onClick={() => setEosOpen((open) => !open)}
          >
            <span>End of Support Alerts (All Hardware)</span>
            <span className="panel-header-meta">
              {eosAlerts.length} {eosAlerts.length === 1 ? 'alert' : 'alerts'}
              <span className="collapse-chevron" aria-hidden="true">
                ▾
              </span>
            </span>
          </button>
          {eosOpen && (
            <>
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
                    {eosPaginatedItems.map((item) => (
                      <tr key={item.id} className={isEosPast(item.end_of_support_date) ? 'eos-past' : 'eos-soon'}>
                        <td>
                          {item.manufacturer} {item.model}
                        </td>
                        <td>
                          {formatHardwareLocation(item)}
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
              <Pagination
                page={eosSafePage}
                totalPages={eosTotalPages}
                totalItems={eosAlerts.length}
                onPageChange={setEosAlertsPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
