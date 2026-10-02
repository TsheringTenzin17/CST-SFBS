import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { DESCRIPTIONS, STATUS } from '../facilityMeta';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Groups individual court rows (e.g. "Badminton Court 1" and "Badminton
// Court 2") into one card per sport, matching the Figma design, while
// the database keeps each physical court as its own bookable resource.
function groupByCourt(facilities) {
  const groups = {};
  for (const f of facilities) {
    const key = f.group_name;
    if (!groups[key]) {
      groups[key] = { ...f, displayName: key, courtCount: 0 };
    }
    groups[key].courtCount += 1;
  }
  return Object.values(groups);
}

function Home() {
  const [facilities, setFacilities] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/facilities`)
      .then((res) => res.json())
      .then(setFacilities)
      .catch(() => {});
  }, []);

  const grouped = groupByCourt(facilities);

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="hero-badge">NEW STREAMLINED BOOKING PROCESS</span>
          <h1>Book Your Game, Skip the Queue</h1>
          <p>
            Access the sports facilities of the College of Science &amp; Technology securely.
            Check real-time court availability, book immediately, and manage your campus
            activity seamlessly.
          </p>
          <div className="hero-buttons">
            <Link to="/facilities" className="btn-green">Browse Facilities</Link>
            <Link to="/my-bookings" className="btn-outline-white">My Bookings</Link>
          </div>
        </div>
        <div className="hero-image">
            <img src="/images/collegeCST.jpg" alt="CST campus aerial view" className="hero-img" />
        </div>
      </section>

      <section className="main">
        <h2 className="title">Our Sports Arenas</h2>
        <p className="subtitle">
          Choose a facility below to view details, time-slot allocation rules, and make your reservations.
        </p>

        <div className="grid">
          {grouped.map((f) => {
            const status = STATUS[f.type] || { label: '', variant: 'green' };
            return (
              <Link to="/facilities" className="card card-link" key={f.group_name}>
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
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default Home;