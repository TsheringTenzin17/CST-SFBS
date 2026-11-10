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
  {
    day: 'Monday',
    bands: ['Ground maintenance', 'Ground maintenance', 'Ground maintenance', 'Ground maintenance'],
  },
  { day: 'Tuesday', bands: ['Students', 'Students', 'Hiring', 'Hiring'] },
  {
    day: 'Wednesday',
    bands: [
      'Students',
      'Female students (free; commercial after Wed 12:05 AM)',
      'Hiring',
      'Hiring',
    ],
  },
  {
    day: 'Thursday',
    bands: [
      'Students',
      'Students',
      'Faculty free until Wed 8 PM; then commercial (paid)',
      'Hiring',
    ],
  },
  { day: 'Friday', bands: ['Students', 'Students', 'Hiring', 'Hiring'] },
];

const FOOTBALL_TOURNAMENT = [
  {
    day: 'Monday',
    bands: ['Ground maintenance', 'Ground maintenance', 'Ground maintenance', 'Ground maintenance'],
  },
  { day: 'Tuesday', bands: ['Students', 'Students', 'Hiring', 'Students'] },
  {
    day: 'Wednesday',
    bands: [
      'Students',
      'Students',
      'Female students (free; commercial after Wed 12:05 AM)',
      'Students',
    ],
  },
  {
    day: 'Thursday',
    bands: [
      'Students',
      'Students',
      'Faculty free until Wed 8 PM; then commercial (paid)',
      'Students',
    ],
  },
  { day: 'Friday', bands: ['Students', 'Students', 'Hiring', 'Students'] },
];

function FootballTable({ rows }) {
  return (
    <div className="table-scroll">
      <table className="rules-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>6 – 8 AM</th>
            <th>4 – 6 PM</th>
            <th>6 – 8 PM</th>
            <th>8 – 10 PM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td data-label="Day">
                <strong>{row.day}</strong>
              </td>
              {row.bands.map((b, i) => (
                <td data-label={['6 – 8 AM', '4 – 6 PM', '6 – 8 PM', '8 – 10 PM'][i]} key={i}>
                  {b}
                </td>
              ))}
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
      <p className="subtitle">
        Rules agreed with the Dean of Student Affairs (DSA), College of Science and Technology.
      </p>

      <div className="rules-grid">
        {/* ---------- general ---------- */}
        <section className="rule-box">
          <h2>All facilities</h2>
          <ul>
            <li>
              Weekdays: open 4:00 PM – 10:00 PM. From 8:00 AM to 4:00 PM nothing can be booked. The
              one exception is the football ground, which also has a student slot from 6:00 AM to
              8:00 AM, Tuesday to Sunday.
            </li>
            <li>Weekends: open all day (busiest 4:00 PM – 10:00 PM).</li>
            <li>
              Free bookings are confirmed instantly. Commercial football slots require offline
              payment at the DSA office and admin approval.
            </li>
            <li>
              Students and staff can book with a college email, outsiders can register by their own
              email.
            </li>
          </ul>
        </section>

        {/* ---------- other sports ---------- */}
        <section className="rule-box">
          <h2>Basketball, volleyball, badminton, table tennis</h2>
          <ul>
            <li>Open 4:00 PM – 10:00 PM only.</li>
            <li>
              Eligible student bookings are free. Commercial bookings, including outsider bookings,
              cost Nu. 1,500 per booking. Submit the payment screenshot and journal number when
              booking; an administrator verifies payment before approval.
            </li>
            <li>
              Maximum booking: <strong>1 hour</strong>.
            </li>
          </ul>
        </section>

        {/* ---------- football weekdays ---------- */}
        <section className="rule-box wide">
          <h2>Football ground: weekdays (no department tournament)</h2>
          <FootballTable rows={FOOTBALL_STANDARD} />
          <p className="rule-note">
            The Wednesday 4 – 6 PM female-student slot is free for female students. From 12:05 AM on
            Wednesday, an unbooked slot also opens for commercial bookings, which require payment.
            Weekday bookings are 2 hours.
          </p>
        </section>

        <section className="rule-box wide">
          <h2>Football ground: weekdays during a department tournament</h2>
          <FootballTable rows={FOOTBALL_TOURNAMENT} />
          <p className="rule-note">
            The Wednesday 6 – 8 PM female-student slot is free for female students. From 12:05 AM on
            Wednesday, an unbooked slot also opens for commercial bookings, which require payment.
            The admin sets the tournament dates.
          </p>
        </section>

        <section className="rule-box">
          <h2>Thursday faculty slot</h2>
          <ul>
            <li>
              The 6:00 PM – 8:00 PM football slot is free for faculty/staff until Wednesday at 8:00
              PM.
            </li>
            <li>
              If it is still unbooked at Wednesday 8:00 PM, it opens as a commercial slot. Students,
              faculty/staff, and outsiders can book it with the applicable commercial fee and DSA
              payment approval.
            </li>
          </ul>
        </section>

        {/* ---------- football weekends ---------- */}
        <section className="rule-box">
          <h2>Football ground: weekends</h2>
          <ul>
            <li>Saturday: max 3 student matches (6 – 8 AM, 8 – 10 AM, 10 AM – 12 PM).</li>
            <li>
              Sunday: 6 – 8 AM, 8 – 10 AM, 10 AM – 12 PM or 2 – 4 PM, but only 3 bookings; the day
              closes once 3 are made.
            </li>
            <li>4:00 PM – 10:00 PM: hiring (both days).</li>
            <li>The admin can prioritise or cancel any booking for an official arrangement.</li>
          </ul>
        </section>

        {/* ---------- archery ---------- */}
        <section className="rule-box">
          <h2>Archery range</h2>
          <p className="rule-note">
            The DSA left archery open, so these hours were proposed by the project team.
          </p>
          <ul>
            <li>Monday – Friday: 4:00 PM – 10:00 PM.</li>
            <li>Saturday – Sunday: 8:00 AM – 10:00 PM.</li>
            <li>2-hour bookings.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

export default Rules;
