// =============================================================
// frontend/src/pages/BookingConfirmation.jsx  —  success screen  (owner: Samdrup)
// =============================================================
// Route:  /booking-confirmed   (BookingForm passes the details with navigate(..., { state }))
// Opening this address directly, without booking first, shows a friendly message.
import { Link, useLocation } from 'react-router-dom';
import { prettyDate } from '../utils/format';
import './Booking.css';

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function roleLabel(role) {
  const labels = {
    student: 'Student',
    faculty: 'Faculty / Staff',
    outsider: 'Outsider',
    admin: 'Admin',
  };
  return labels[role] || role;
}

function BookingConfirmation() {
  const { state } = useLocation();

  if (!state) {
    return (
      <main className="main">
        <p>
          No booking to show. <Link to="/my-bookings">View My Bookings</Link>
        </p>
      </main>
    );
  }

  const requiresApproval = state.status === 'pending';
  const requiresPayment = Number(state.paymentAmount) > 0;
  const isPaidFootballBooking = requiresPayment && state.facility === 'Football Ground';

  return (
    <main className="main">
      <div className="confirm-wrap">
        <div className="confirm-check">✓</div>
        <h1 className="confirm-title">
          {requiresApproval ? 'Booking Submitted Successfully!' : 'Booking Confirmed Successfully!'}
        </h1>
        <p className="confirm-subtitle">
          {requiresApproval
            ? 'Your reservation request has been registered in the CST scheduling database.'
            : 'Your free facility reservation has been confirmed instantly.'}
        </p>

        <div className="confirm-card">
          <div className="confirm-card-heading">
            <h2>Reservation Summary</h2>
            {requiresApproval && <span className="confirm-status">Pending Approval</span>}
          </div>
          <div className="confirm-row">
            <span>Facility</span>
            <strong>{state.facility}</strong>
          </div>
          <div className="confirm-row">
            <span>Date</span>
            <strong>{prettyDate(state.date)}</strong>
          </div>
          <div className="confirm-row confirm-time-row">
            <span>Time Slot</span>
            <strong>
              {formatTime(state.start)} – {formatTime(state.end)}
            </strong>
          </div>
          <div className="confirm-row">
            <span>Booking ID</span>
            <strong>B-{state.bookingId}</strong>
          </div>
          <div className="confirm-row">
            <span>Requester Role</span>
            <strong>{roleLabel(state.role)}</strong>
          </div>
          {requiresPayment && (
            <>
              <div className="confirm-row">
                <span>Payment Amount</span>
                <strong>Nu. {Number(state.paymentAmount).toLocaleString()}</strong>
              </div>
              {isPaidFootballBooking && (
                <div className="confirm-row">
                  <span>Referee Service</span>
                  <strong>{state.refereeService}</strong>
                </div>
              )}
              <div className="confirm-row">
                <span>Account Number</span>
                <strong>{state.paymentAccountNumber}</strong>
              </div>
              <div className="confirm-row">
                <span>Journal Number</span>
                <strong>{state.paymentJournalNumber}</strong>
              </div>
              <div className="confirm-row">
                <span>Payment Screenshot</span>
                <strong>{state.hasPaymentScreenshot ? 'Submitted' : 'Not required'}</strong>
              </div>
            </>
          )}
          {requiresApproval ? (
            <div className="confirm-note confirm-note-payment" role="alert">
              <strong className="confirm-payment-heading">
                Payment submitted — awaiting verification
              </strong>
              <p>
                Your booking will be confirmed after an administrator checks the payment screenshot
                and journal number.
              </p>
              {requiresPayment && (
                <p>
                  If it is not approved by the booking start time, the request will expire. You can
                  then choose a full refund or booking credit, and the DSA will arrange your choice.
                </p>
              )}
            </div>
          ) : (
            <div className="confirm-note confirm-note-free">
              Please Note: No approval or payment is required for students and staff. Your
              reservation is active.
            </div>
          )}
        </div>

        <div className="confirm-actions">
          <Link to="/facilities" className="btn-secondary">
            Book Another Facility
          </Link>
          <Link to="/my-bookings" className="btn-primary btn-link">
            View My Bookings
          </Link>
        </div>
      </div>
    </main>
  );
}

export default BookingConfirmation;
