import { Link, useLocation } from 'react-router-dom';
import { prettyDate } from '../utils/format';
import './CancellationConfirmation.css';

function CancellationConfirmation() {
  const { state } = useLocation();

  if (!state?.bookingId || !state?.facility || !state?.date || !state?.start || !state?.end) {
    return (
      <main className="main cancellation-page">
        <p>
          No recent cancellation to show. <Link to="/my-bookings">View My Bookings</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="main cancellation-page">
      <section
        className="cancellation-confirmation confirm-wrap"
        aria-labelledby="cancellation-title"
      >
        <div className="confirm-check cancellation-icon" aria-hidden="true">
          <span aria-hidden="true">×</span>
        </div>
        <h1 id="cancellation-title" className="confirm-title">
          Booking Cancelled Successfully!
        </h1>
        <p className="confirm-subtitle cancellation-subtitle">
          Your reservation slot has been released and is available for others to book.
        </p>

        <div className="confirm-card cancellation-summary">
          <div className="confirm-card-heading cancellation-card-heading">
            <h2>Cancellation Summary</h2>
          </div>
          <div className="confirm-row cancellation-row">
            <span>Facility</span>
            <strong>{state.facility}</strong>
          </div>
          <div className="confirm-row cancellation-row">
            <span>Date</span>
            <strong>{prettyDate(state.date)}</strong>
          </div>
          <div className="confirm-row confirm-time-row cancellation-row cancellation-time-row">
            <span>Time slot</span>
            <strong className="cancellation-time">
              {state.start} – {state.end}
            </strong>
          </div>
          <div className="confirm-row cancellation-row">
            <span>Booking ID</span>
            <strong>B-{state.bookingId}</strong>
          </div>
          <div className="cancellation-released">
            <strong>Slot released</strong>
          </div>
          <p className="confirm-note cancellation-note">
            You can book another available time at any time. Check the availability page for the
            latest slots.
          </p>
        </div>

        <div className="confirm-actions cancellation-actions">
          <Link to="/facilities" className="btn-secondary">
            Book Another Facility
          </Link>
          <Link to="/my-bookings" className="btn-primary btn-link">
            View My Bookings
          </Link>
        </div>
      </section>
    </main>
  );
}

export default CancellationConfirmation;
