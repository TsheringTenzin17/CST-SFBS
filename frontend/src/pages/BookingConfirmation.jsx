import { Link, useLocation } from 'react-router-dom';
import { prettyDate } from '../utils/format';
import './Booking.css';

function BookingConfirmation() {
  const { state } = useLocation();

  if (!state) {
    return (
      <main className="main">
        <p>No booking to show. <Link to="/my-bookings">View My Bookings</Link></p>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="confirm-wrap">
        <div className="confirm-check">✓</div>
        <h1 className="title">Booking Confirmed!</h1>
        <p className="subtitle">Your slot is confirmed instantly. No approval is needed.</p>

        <div className="confirm-card">
          <div className="confirm-row"><span>Facility</span><strong>{state.facility}</strong></div>
          <div className="confirm-row"><span>Date</span><strong>{prettyDate(state.date)}</strong></div>
          <div className="confirm-row"><span>Time slot</span><strong>{state.start} – {state.end}</strong></div>
          <div className="confirm-row"><span>Booking ID</span><strong>B-{state.bookingId}</strong></div>
          <div className="confirm-row"><span>Booked as</span><strong>{state.role}</strong></div>
        </div>

        <div className="confirm-actions">
          <Link to="/facilities" className="btn-secondary">Book Another Facility</Link>
          <Link to="/my-bookings" className="btn-primary btn-link">View My Bookings</Link>
        </div>
      </div>
    </main>
  );
}

export default BookingConfirmation;