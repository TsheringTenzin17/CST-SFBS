// useEffect = run code when the page loads (we use it to fetch data)
// useState = remember values that can change (facilities, loading, filter...)
import { useEffect, useState } from 'react';

// Link = a clickable element that changes the page WITHOUT reloading the browser
import { Link } from 'react-router-dom';

// Text/labels for each sport, kept in a separate file
import { DESCRIPTIONS, STATUS, SLOTS_TEXT } from '../facilityMeta';

// Backend address: uses the .env value if set, otherwise localhost:4000
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Facility types that count as "indoor" for the Indoor Arenas filter
const INDOOR_TYPES = ['basketball', 'badminton', 'table_tennis'];

// The database has one row per court. This merges rows of the same sport
// into ONE card (e.g. 2 volleyball courts become 1 card saying "2 courts")
function groupByCourt(facilities) {
  const groups = {};                       // empty box to collect the groups
  for (const f of facilities) {            // go through every court row
    const key = f.group_name;              // the sport name, e.g. "Volleyball Court"
    if (!groups[key]) {                    // first time we see this sport?
      groups[key] = { ...f, displayName: key, courtCount: 0, courtIds: [] };
    }
    groups[key].courtCount += 1;           // count this court
    groups[key].courtIds.push(f.id);       // remember this court's id
  }
  return Object.values(groups);            // turn the box into a plain array
}

function Facilities() {
  const [facilities, setFacilities] = useState([]);  // data from the backend
  const [loading, setLoading] = useState(true);      // true while waiting for data
  const [error, setError] = useState(null);          // error message if fetch fails
  const [filter, setFilter] = useState('all');       // active tab: all | available | indoor

  // Runs once when the page opens (the [] at the end means "only once")
  useEffect(() => {
    fetch(`${API_URL}/facilities`)                   // ask the backend for facilities
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`); // bad reply = error
        return res.json();                           // convert reply to JavaScript data
      })
      .then((data) => {
        setFacilities(data);                         // save the data
        setLoading(false);                           // stop showing "Loading"
      })
      .catch((err) => {
        setError(err.message);                       // save the error to show on screen
        setLoading(false);
      });
  }, []);

  const grouped = groupByCourt(facilities);          // one card per sport

  // Keep only the cards that match the selected filter tab
  const visible = grouped.filter((f) => {
    if (filter === 'available') return STATUS[f.type]?.variant === 'green'; // green badge only
    if (filter === 'indoor') return INDOOR_TYPES.includes(f.type);          // indoor sports only
    return true;                                                            // "all": keep everything
  });

  return (
    <main className="main">
      <h1 className="title">All Sports Facilities</h1>
      <p className="subtitle">
        Select any of the College of Science and Technology sports facilities below to read rules, check hourly slots, and book activities.
      </p>

      {/* Filter buttons + sort label */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {/* The clicked tab gets the "active" class so it looks highlighted */}
          <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>All Facilities</button>
          <button className={filter === 'available' ? 'tab active' : 'tab'} onClick={() => setFilter('available')}>Available Today</button>
          <button className={filter === 'indoor' ? 'tab active' : 'tab'} onClick={() => setFilter('indoor')}>Indoor Arenas</button>
        </div>
        <div className="sort-label">Sort By: <strong>Availability (High to Low)</strong></div>
      </div>

      {/* Show "Loading" only while waiting for the backend */}
      {loading && <p>Loading facilities…</p>}

      {/* Show the error message only if the fetch failed */}
      {error && (
        <p className="error">
          Couldn't reach the backend ({error}). Make sure it is running on {API_URL}.
        </p>
      )}

      {/* The grid of facility cards */}
      <div className="grid">
        {visible.map((f) => {
          // Badge text/colour for this sport (fallback if missing)
          const status = STATUS[f.type] || { label: '', variant: 'green' };
          // A red badge means fully booked, so the button gets disabled
          const isFull = status.variant === 'red';

          return (
            // "key" helps React track each card; group_name is unique per sport
            <div className="card" key={f.group_name}>
              {/* Picture loaded from public/images/<type>.jpg */}
              <img
                className="card-img"
                src={`/images/${f.type}.jpg`}
                alt={f.displayName}
                onError={(e) => { e.target.style.visibility = 'hidden'; }} // hide broken image icon
              />

              <div className="card-body">
                <div className="card-title-row">
                  <h3 className="card-title">
                    {f.displayName}
                    {/* Show "(2 courts)" only when there's more than one court */}
                    {f.courtCount > 1 && <span className="court-count"> ({f.courtCount} courts)</span>}
                  </h3>
                  {/* Coloured badge: "Available Today", "Fully Booked", etc. */}
                  <span className={`badge badge-${status.variant}`}>{status.label}</span>
                </div>

                {/* Short description from facilityMeta.js */}
                <p className="card-desc">{DESCRIPTIONS[f.type] || ''}</p>

                <div className="card-footer-row">
                  {/* e.g. "12 Slots Available" */}
                  <span className="slots-text">{SLOTS_TEXT[f.type]}</span>

                  {/* THE FIX: if fully booked, show a greyed-out dead button.
                      Otherwise show a Link that opens /facilities/football etc. */}
                  {isFull ? (
                    <button className="btn-primary" disabled>View Details &amp; Book</button>
                  ) : (
                    <Link
                      to={`/facilities/${f.type}`}            // the page to open, built from the sport type
                      className="btn-primary"                 // same blue button styling as before
                      style={{ textDecoration: 'none', display: 'inline-block' }} // remove link underline
                    >
                      View Details &amp; Book
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

// Lets App.jsx import this page
export default Facilities;