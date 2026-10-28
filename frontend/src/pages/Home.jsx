// =============================================================
// frontend/src/pages/Home.jsx  —  landing page  (owner: Lhamo)
// =============================================================
// Sections:  1. data   2. hero banner   3. "Our Sports Arenas" cards
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DESCRIPTIONS, IMAGES } from '../facilityMeta';
import { apiCall } from '../utils/api';
import { badgeFor, groupFacilities } from '../utils/availability';
import { todayString } from '../utils/slots';
import useSummary from '../hooks/useSummary';

function Home() {
  // ---------- 1. data ----------
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [heroSlide, setHeroSlide] = useState(0);
  const [finderSport, setFinderSport] = useState('all');
  const [finderDate, setFinderDate] = useState(todayString());
  const { summary } = useSummary(todayString()); // real counts for today

  useEffect(() => {
    apiCall('/facilities').then(setFacilities).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % 2);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const cards = groupFacilities(facilities);

  const handle3dMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--pointer-x', `${x}`);
    event.currentTarget.style.setProperty('--pointer-y', `${y}`);
  };

  const reset3d = (event) => {
    event.currentTarget.style.setProperty('--pointer-x', '0');
    event.currentTarget.style.setProperty('--pointer-y', '0');
  };

  return (
    <>
      {/* ---------- 2. hero banner ---------- */}
      <section
        className={`hero-carousel hero-slide-${heroSlide}`}
        aria-label="Campus highlights"
        onMouseMove={handle3dMove}
        onMouseLeave={reset3d}
      >
        <div className={`hero hero-slide ${heroSlide === 0 ? 'is-active' : ''}`} />
        <div className={`hero-banner-slide ${heroSlide === 1 ? 'is-active' : ''}`}>
          <img src="/images/foundation-day.png" alt="CST 25th Foundation Day" />
        </div>
        <div className="hero-text">
          <div className="hero-location">CST CAMPUS / PHUENTSHOLING, BHUTAN</div>
          <h1>
            <span>Your Campus.</span>
            <strong>Your Game.</strong>
          </h1>
          <p>
            Less waiting. More playing. Find your court, check available slots
            and book your next game at CST.
          </p>
          <small>For students, staff &amp; our sporting community.</small>
        </div>
        <div className="hero-buttons">
          <Link to="/facilities" className="btn-green">Browse Facilities</Link>
          <Link to="/my-bookings" className="btn-outline-white">My Bookings</Link>
        </div>
        <button className="hero-arrow hero-arrow-prev" type="button" aria-label="Previous banner" onClick={() => setHeroSlide(0)}>&#8249;</button>
        <button className="hero-arrow hero-arrow-next" type="button" aria-label="Next banner" onClick={() => setHeroSlide(1)}>&#8250;</button>
        <div className="hero-dots" aria-label="Choose banner">
          {[0, 1].map((slide) => (
            <button
              key={slide}
              type="button"
              className={heroSlide === slide ? 'active' : ''}
              aria-label={`Show banner ${slide + 1}`}
              onClick={() => setHeroSlide(slide)}
            />
          ))}
        </div>
      </section>

      <nav className="sport-category-strip" aria-label="Browse sports facilities">
        <span className="sport-category-title">Browse by Sport</span>
        {[
          ['⚽', 'Football'],
          ['🏀', 'Basketball'],
          ['🏹', 'Archery'],
          ['🏸', 'Badminton'],
          ['🏓', 'Table Tennis'],
          ['🏐', 'Volleyball'],
        ].map(([icon, sport]) => (
          <Link to="/facilities" className="sport-category-item" key={sport}>
            <span className="sport-category-icon" aria-hidden="true">{icon}</span>
            <span>{sport}</span>
          </Link>
        ))}
      </nav>

      <section className="availability-finder" aria-label="Find available sports slots">
        <div className="availability-heading">
          <span>Make time to play</span>
          <h2>Find your next<br />slot</h2>
        </div>
        <div className="availability-fields">
          <label>
            <span>Sport</span>
            <select value={finderSport} onChange={(event) => setFinderSport(event.target.value)}>
              <option value="all">All sports</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="archery">Archery</option>
              <option value="badminton">Badminton</option>
              <option value="table_tennis">Table Tennis</option>
              <option value="volleyball">Volleyball</option>
            </select>
          </label>
          <label>
            <span>When</span>
            <input
              type="date"
              value={finderDate}
              min={todayString()}
              onChange={(event) => setFinderDate(event.target.value)}
            />
          </label>
          <button
            className="availability-check"
            type="button"
            onClick={() => navigate(`/facilities?sport=${encodeURIComponent(finderSport)}&date=${encodeURIComponent(finderDate)}`)}
          >
            Check availability <span aria-hidden="true">↗</span>
          </button>
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
              <Link
                to={`/facilities/${f.courtIds[0]}`}
                className="card card-link card-3d"
                key={f.group_name}
                onMouseMove={handle3dMove}
                onMouseLeave={reset3d}
              >
                <img
                  className="card-img"
                  src={IMAGES[f.type]}
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

        <aside className="booking-guidance" aria-label="Booking guidance">
          <div>
            <strong>Good games start with a fair booking.</strong>
            <p>Check allocation rules before reserving. Community booking payments are handled offline.</p>
          </div>
          <Link to="/rules" className="booking-guidance-link">
            Booking rules <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </section>

      <section className="stats-ticker" aria-label="CST Sports Facility statistics">
        <div className="stats-ticker-item">
          <strong>06</strong>
          <span>Sport facilities</span>
        </div>
        <div className="stats-ticker-item">
          <strong>50+</strong>
          <span>Daily slots</span>
        </div>
        <div className="stats-ticker-item">
          <strong>24/7</strong>
          <span>Online booking</span>
        </div>
        <div className="stats-ticker-item">
          <strong>CST</strong>
          <span>Phuentsholing, Bhutan</span>
        </div>
      </section>
    </>
  );
}

export default Home;