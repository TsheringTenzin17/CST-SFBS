import './FeeStructure.css';

function FeeStructure() {
  return (
    <main className="main fee-page">
      <h1 className="title">Fee Structure</h1>
      <p className="subtitle">
        Facility charges for bookings at the College of Science and Technology.
      </p>

      <section className="fee-card">
        <h2>Football ground</h2>
        <p className="fee-intro">
          Students and faculty/staff must also pay when booking a commercial slot. The Wednesday
          female-student slot is free for female students.
        </p>
        <div className="fee-table-scroll">
          <table className="fee-table">
            <thead>
              <tr>
                <th scope="col">Booking group</th>
                <th scope="col">Booking time</th>
                <th scope="col">One referee</th>
                <th scope="col">Referee and assistant referees</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Students</th>
                <td data-label="Booking time">All days</td>
                <td data-label="One referee">Nu. 2,500</td>
                <td data-label="Referee and assistant referees">Nu. 2,900</td>
              </tr>
              <tr>
                <th scope="row">Staff and outsiders</th>
                <td data-label="Booking time">Weekdays</td>
                <td data-label="One referee">Nu. 3,500</td>
                <td data-label="Referee and assistant referees">Nu. 3,900</td>
              </tr>
              <tr>
                <th scope="row">Staff and outsiders</th>
                <td data-label="Booking time">Weekends</td>
                <td data-label="One referee">Nu. 4,000</td>
                <td data-label="Referee and assistant referees">Nu. 4,400</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="fee-note">
          Commercial football bookings must be paid offline at the DSA office before an admin can
          approve the booking. The Thursday 6:00 PM – 8:00 PM faculty slot is free for faculty/staff
          until Wednesday at 8:00 PM, then becomes commercial if unbooked.
        </p>
      </section>

      <section className="fee-card">
        <h2>Other facilities</h2>
        <p>
          Student bookings for basketball, volleyball, badminton, and table tennis are free.
          Outsider commercial rates for these facilities are handled offline with the DSA office.
        </p>
      </section>
    </main>
  );
}

export default FeeStructure;
