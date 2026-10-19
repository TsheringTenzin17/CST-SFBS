// =============================================================
// frontend/src/pages/Home.jsx  —  landing page  (owner: Lhamo)
// =============================================================
// Sections:  1. data   2. hero banner   3. "Our Sports Arenas" cards
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DESCRIPTIONS } from '../facilityMeta';
import { apiCall } from '../utils/api';
import { badgeFor, groupFacilities } from '../utils/availability';
import { todayString } from '../utils/slots';
import useSummary from '../hooks/useSummary';

function Home() {
  // ---------- 1. data ----------
  const [facilities, setFacilities] = useState([]);
  const { summary } = useSummary(todayString()); // real counts for today

  useEffect(() => {
    apiCall('/facilities').then(setFacilities).catch(() => {});
  }, []);

  const cards = groupFacilities(facilities);

  return (
    <>
      {/* ---------- 2. hero banner ---------- */}
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

      {/* ---------- 3. facility cards ---------- */}
      <section className="main">
        <h2 className="title">Our Sports Arenas</h2>
        <p className="subtitle">
          Choose a facility below to view details, time-slot allocation rules, and make your reservations.
        </p>

        <div className="grid">
          {cards.map((f) => {
            const badge = badgeFor(summary[f.group_name]);
            return (
              <Link to={`/facilities/${f.courtIds[0]}`} className="card card-link" key={f.group_name}>
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
                    {badge.label && <span className={`badge badge-${badge.variant}`}>{badge.label}</span>}
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