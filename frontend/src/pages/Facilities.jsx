// =============================================================
// frontend/src/pages/Facilities.jsx  —  all facilities  (owner: Lhamo)
// =============================================================
// Sections:  1. data   2. filter + sort   3. page layout
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DESCRIPTIONS, IMAGES } from '../facilityMeta';
import { FacilityCardSkeletons, Skeleton } from '../components/Loading';
import { apiCall } from '../utils/api';
import { badgeFor, groupFacilities, slotsText } from '../utils/availability';
import { todayString } from '../utils/slots';
import useSummary from '../hooks/useSummary';
import './Facilities.css';

const INDOOR_TYPES = ['basketball', 'badminton', 'table_tennis'];

function Facilities() {
  // ---------- 1. data ----------
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | available | indoor
  const [sortOrder, setSortOrder] = useState('desc');
  const { summary, loading: summaryLoading } = useSummary(todayString());

  useEffect(() => {
    apiCall('/facilities')
      .then(setFacilities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ---------- 2. filter + sort ----------
  const freeNow = (f) => (summary[f.group_name] ? summary[f.group_name].available : 0);

  const visible = groupFacilities(facilities)
    .filter((f) => {
      if (filter === 'available') return freeNow(f) > 0;
      if (filter === 'indoor') return INDOOR_TYPES.includes(f.type);
      return true;
    })
    .sort((a, b) => (sortOrder === 'desc' ? freeNow(b) - freeNow(a) : freeNow(a) - freeNow(b)));

  // ---------- 3. layout ----------
  return (
    <main className="main facilities-page">
      <section className="facilities-heading">
        <div>
          <span className="facilities-eyebrow">CST Sports</span>
          <h1 className="title">Find your facility</h1>
          <p className="subtitle">
            Explore courts and fields, check today’s availability, and reserve your preferred slot.
          </p>
        </div>
        <Link to="/rules" className="facilities-rules-link">
          <span>View booking rules</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <div className="filter-bar facilities-filter-bar">
        <div className="filter-tabs">
          <button
            className={filter === 'all' ? 'tab active' : 'tab'}
            onClick={() => setFilter('all')}
          >
            All Facilities
          </button>
          <button
            className={filter === 'available' ? 'tab active' : 'tab'}
            onClick={() => setFilter('available')}
          >
            Available Today
          </button>
          <button
            className={filter === 'indoor' ? 'tab active' : 'tab'}
            onClick={() => setFilter('indoor')}
          >
            Indoor Arenas
          </button>
        </div>
        <label className="sort-label">
          <span>Sort By:</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            aria-label="Sort facilities by availability"
          >
            <option value="desc">Availability (High to Low)</option>
            <option value="asc">Availability (Low to High)</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {!loading && !summaryLoading && !error && visible.length === 0 && (
        <p>No facilities match this filter.</p>
      )}

      {loading || summaryLoading ? (
        <FacilityCardSkeletons />
      ) : (
        <div className="grid">
          {visible.map((f) => {
            const s = summary[f.group_name];
            const badge = badgeFor(s);
            const isFull = Boolean(s) && s.available === 0;
            return (
              <div className="card" key={f.group_name}>
                <img
                  className="card-img"
                  src={f.image_url || IMAGES[f.type]}
                  alt={f.displayName}
                  onError={(e) => {
                    e.target.style.visibility = 'hidden';
                  }}
                />
                <div className="card-body">
                  <div className="card-title-row">
                    <h3 className="card-title">
                      {f.displayName}
                      {f.courtCount > 1 && (
                        <span className="court-count"> ({f.courtCount} courts)</span>
                      )}
                    </h3>
                    {badge.label && (
                      <span className={`badge badge-${badge.variant}`}>{badge.label}</span>
                    )}
                  </div>
                  <p className="card-desc">{f.description || DESCRIPTIONS[f.type] || ''}</p>
                  <div className="card-footer-row">
                    <span className="slots-text">{slotsText(s)}</span>
                    {/* Even a fully booked facility stays clickable: other days may be free. */}
                    <Link
                      to={`/facilities/${f.courtIds[0]}`}
                      className="btn-primary btn-link"
                      style={{ opacity: isFull ? 0.75 : 1 }}
                    >
                      View Details &amp; Book
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default Facilities;
