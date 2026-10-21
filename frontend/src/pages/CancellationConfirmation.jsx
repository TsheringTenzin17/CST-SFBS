import { Link, useLocation } from 'react-router-dom';
import { prettyDate } from '../utils/format';
import './CancellationConfirmation.css';

function CancellationConfirmation() {
  const { state } = useLocation();

  if (!state?.bookingId || !state?.facility || !state?.date || !state?.start || !state?.end) {
    return (
      <main className="main cancellation-page">
        <p>No recent cancellation to show. <Link to="/my-bookings">View My Bookings</Link></p>
      </main>
    );
  }

  return (
    <main className="main cancellation-page">
      <section className="cancellation-confirmation" aria-labelledby="cancellation-title">
        <div className="cancellation-icon" aria-hidden="true">×</div>
        <h1 id="cancellation-title">Booking Cancelled Successfully</h1>
        <p className="cancellation-subtitle">
          Your reservation slot has been released and is available for others to book.
        </p>

        <div className="cancellation-summary">
          <h2>Cancellation Summary</h2>
          <div className="cancellation-row">
            <span>Facility</span>
            <strong>{state.facility}</strong>
          </div>
          <div className="cancellation-row">
            <span>Date</span>
            <strong>{prettyDate(state.date)}</strong>
          </div>
          <div className="cancellation-row">
            <span>Time slot</span>
            <strong className="cancellation-time">{state.start} – {state.end}</strong>
          </div>
          <div className="cancellation-row">
            <span>Booking ID</span>
            <strong>B-{state.bookingId}</strong>
          </div>
          <div className="cancellation-released">
            <strong>Slot released</strong>
          </div>
          <p className="cancellation-note">
            You can book another available time at any time. Check the availability page for the latest slots.
          </p>
        </div>

        <div className="cancellation-actions">
          <Link to="/facilities" className="btn-secondary">Book Another Facility</Link>
          <Link to="/my-bookings" className="btn-primary btn-link">View My Bookings</Link>
        </div>
      </section>
    </main>
  );
}

export default CancellationConfirmation;
