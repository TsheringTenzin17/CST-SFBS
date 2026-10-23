// =============================================================
// frontend/src/pages/Rules.jsx  —  the booking rules in plain words  (owner: Lhamo)
// =============================================================
// Route:  /rules
// SOURCE OF TRUTH: the DSA meeting on 20 Aug 2026 (Requirement Gathering
// Summary). This page is typed by hand, so if a rule in
// Backend/src/db/seed.sql changes, change it here too.
import './Rules.css';

// Football weekday table: one row per day, one cell per time band.
const FOOTBALL_WEEKDAYS = [
  { day: 'Monday', bands: ['Maintenance / college team', 'Maintenance / college team', 'Maintenance / college team'] },
  { day: 'Tuesday', bands: ['Free (students)', 'Commercial', 'Free (student) or commercial'] },
  { day: 'Wednesday', bands: ['Free (students)', 'Female faculty (commercial if unused)', 'Free (student) or commercial'] },
  { day: 'Thursday', bands: ['Free (students)', 'Male faculty', 'Free (student) or commercial'] },
  { day: 'Friday', bands: ['Free (students)', 'Commercial', 'Free (student) or commercial'] },
];

function Rules() {
  return (
    <main className="main">
      <h1 className="title">Facility Booking Rules</h1>
      <p className="subtitle">Rules agreed with the Dean of Student Affairs (DSA), College of Science and Technology.</p>

      <div className="rules-grid">
        {/* ---------- general ---------- */}
        <section className="rule-box">
          <h2>All facilities</h2>
          <ul>
            <li>Weekdays: open 4:00 PM – 10:00 PM. From 8:00 AM to 4:00 PM nothing can be booked.</li>
            <li>Weekends: open all day (busiest 4:00 PM – 10:00 PM).</li>
            <li>Bookings are confirmed instantly. No approval is needed.</li>
            <li>Students and staff can book with a college email. Outsiders can register too.</li>
          </ul>
        </section>

        {/* ---------- other sports ---------- */}
        <section className="rule-box">
          <h2>Basketball, volleyball, badminton, table tennis</h2>
          <ul>
            <li>Open 4:00 PM – 10:00 PM only.</li>
            <li>Free for students. Outsiders pay the commercial rate (handled offline with the DSA office).</li>
            <li>Maximum booking: <strong>1 hour</strong>.</li>
          </ul>
        </section>

        {/* ---------- football weekdays ---------- */}
        <section className="rule-box wide">
          <h2>Football ground: weekdays</h2>
          <p className="rule-note">Every day there is also a free 6:00 – 8:00 AM slot for students.</p>
          <div className="table-scroll">
            <table className="rules-table">
              <thead>
                <tr><th>Day</th><th>4 – 6 PM</th><th>6 – 8 PM</th><th>8 – 10 PM</th></tr>
              </thead>
              <tbody>
                {FOOTBALL_WEEKDAYS.map((row) => (
                  <tr key={row.day}>
                    <td><strong>{row.day}</strong></td>
                    {row.bands.map((b, i) => <td key={i}>{b}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rule-note">
            Wednesday 6 – 8 PM opens to commercial users automatically 1 hour before it starts if faculty have not booked it.
          </p>
        </section>

        {/* ---------- football weekends ---------- */}
        <section className="rule-box">
          <h2>Football ground: weekends</h2>
          <ul>
            <li>Before 4:00 PM: 3 matches, reserved for students.</li>
            <li>4:00 PM – 10:00 PM: commercial use.</li>
          </ul>
        </section>

        {/* ---------- archery ---------- */}
        <section className="rule-box">
          <h2>Archery range</h2>
          <p className="rule-note">The DSA left archery open, so these hours were proposed by the project team.</p>
          <ul>
            <li>Monday – Friday: 4:00 PM – 6:00 PM (daylight only).</li>
            <li>Saturday – Sunday: 8:00 AM – 10:00 PM.</li>
            <li>2-hour bookings.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

export default Rules;