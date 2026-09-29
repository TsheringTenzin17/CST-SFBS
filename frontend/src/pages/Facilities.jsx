import { useEffect, useState } from 'react';
import { DESCRIPTIONS, STATUS, SLOTS_TEXT } from '../facilityMeta';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const INDOOR_TYPES = ['basketball', 'badminton', 'table_tennis'];

// Same grouping logic as Home.jsx — one card per sport, not per court row.
function groupByCourt(facilities) {
  const groups = {};
  for (const f of facilities) {
    const key = f.group_name;
    if (!groups[key]) {
      groups[key] = { ...f, displayName: key, courtCount: 0, courtIds: [] };
    }
    groups[key].courtCount += 1;
    groups[key].courtIds.push(f.id);
  }
  return Object.values(groups);
}

function Facilities() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | available | indoor

  useEffect(() => {
    fetch(`${API_URL}/facilities`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFacilities(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const grouped = groupByCourt(facilities);

  const visible = grouped.filter((f) => {
    if (filter === 'available') return STATUS[f.type]?.variant === 'green';
    if (filter === 'indoor') return INDOOR_TYPES.includes(f.type);
    return true;
  });

  return (
    <main className="main">
      <h1 className="title">All Sports Facilities</h1>
      <p className="subtitle">
        Select any of the College of Science and Technology sports facilities below to read rules, check hourly slots, and book activities.
      </p>

      <div className="filter-bar">
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>All Facilities</button>
          <button className={filter === 'available' ? 'tab active' : 'tab'} onClick={() => setFilter('available')}>Available Today</button>
          <button className={filter === 'indoor' ? 'tab active' : 'tab'} onClick={() => setFilter('indoor')}>Indoor Arenas</button>
        </div>
        <div className="sort-label">Sort By: <strong>Availability (High to Low)</strong></div>
      </div>

      {loading && <p>Loading facilities…</p>}
      {error && (
        <p className="error">
          Couldn't reach the backend ({error}). Make sure it is running on {API_URL}.
        </p>
      )}

      <div className="grid">
        {visible.map((f) => {
          const status = STATUS[f.type] || { label: '', variant: 'green' };
          const isFull = status.variant === 'red';
          return (
            <div className="card" key={f.group_name}>
              <img
                className="card-img"
                src={`/images/${f.type}.jpg`}
                alt={f.displayName}
                onError={(e) => { e.target.style.visibility = 'hidden'; }}
              />
              <div className="card-body">
                <div className="card-title-row">
                  <h3 className="card-title">
                    {f.displayName}
                    {f.courtCount > 1 && <span className="court-count"> ({f.courtCount} courts)</span>}
                  </h3>
                  <span className={`badge badge-${status.variant}`}>{status.label}</span>
                </div>
                <p className="card-desc">{DESCRIPTIONS[f.type] || ''}</p>
                <div className="card-footer-row">
                  <span className="slots-text">{SLOTS_TEXT[f.type]}</span>
                  <button className="btn-primary" disabled={isFull}>View Details &amp; Book</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default Facilities;