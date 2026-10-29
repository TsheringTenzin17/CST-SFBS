// =============================================================
// frontend/src/pages/Rules.jsx  —  the booking rules in plain words  (owner: Lhamo)
// =============================================================
// Route:  /rules
// SOURCE OF TRUTH: the DSA meeting on 20 Aug 2026 (Requirement Gathering
// Summary). This page is typed by hand, so if a rule in
// Backend/src/db/seed.sql changes, change it here too.
import './Rules.css';

// Football weekday tables (Timings.docx): one row per day, one cell per time band.
const FOOTBALL_STANDARD = [
  { day: 'Monday', bands: ['Ground maintenance', 'Ground maintenance', 'Ground maintenance', 'Ground maintenance'] },
  { day: 'Tuesday', bands: ['Students', 'Students', 'Hiring', 'Hiring'] },
  { day: 'Wednesday', bands: ['Students', 'Reserved for female students', 'Hiring', 'Hiring'] },
  { day: 'Thursday', bands: ['Students', 'Students', 'Reserved for staff', 'Hiring'] },
  { day: 'Friday', bands: ['Students', 'Students', 'Hiring', 'Hiring'] },
];

const FOOTBALL_TOURNAMENT = [
  { day: 'Monday', bands: ['Ground maintenance', 'Ground maintenance', 'Ground maintenance', 'Ground maintenance'] },
  { day: 'Tuesday', bands: ['Students', 'Students', 'Hiring', 'Students'] },
  { day: 'Wednesday', bands: ['Students', 'Students', 'Female students (hiring opens 1 hour before)', 'Students'] },
  { day: 'Thursday', bands: ['Students', 'Students', 'Reserved for staff', 'Students'] },
  { day: 'Friday', bands: ['Students', 'Students', 'Hiring', 'Students'] },
];

function FootballTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="rules-table">
        <thead>
          <tr><th>Day</th><th>6 – 8 AM</th><th>4 – 6 PM</th><th>6 – 8 PM</th><th>8 – 10 PM</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td><strong>{row.day}</strong></td>
              {row.bands.map((b, i) => <td key={i}>{b}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
            <li>Weekdays: open 4:00 PM – 10:00 PM. From 8:00 AM to 4:00 PM nothing can be booked. The one exception is the football ground, which also has a student slot from 6:00 AM to 8:00 AM, Tuesday to Friday.</li>
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
          <h2>Football ground: weekdays (no department tournament)</h2>
          <FootballTable rows={FOOTBALL_STANDARD} />
          <p className="rule-note">
            Wednesday 4 – 6 PM is reserved for female students. Weekday bookings are 2 hours.
          </p>
        </section>

        <section className="rule-box wide">
          <h2>Football ground: weekdays during a department tournament</h2>
          <FootballTable rows={FOOTBALL_TOURNAMENT} />
          <p className="rule-note">
            Wednesday 6 – 8 PM is for female students first and opens to hiring automatically 1 hour before it starts.
            The admin sets the tournament dates.
          </p>
        </section>

        {/* ---------- football weekends ---------- */}
        <section className="rule-box">
          <h2>Football ground: weekends</h2>
          <ul>
            <li>Saturday: max 3 student matches (6 – 8 AM, 8 – 10 AM, 10 AM – 12 PM).</li>
            <li>Sunday: 6 – 8 AM, 8 – 10 AM, 10 AM – 12 PM or 2 – 4 PM, but only 3 bookings; the day closes once 3 are made.</li>
            <li>4:00 PM – 10:00 PM: hiring (both days).</li>
            <li>The admin can prioritise or cancel any booking for an official arrangement.</li>
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