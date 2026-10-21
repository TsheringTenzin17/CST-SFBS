import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { prettyDate } from '../utils/format';
import { apiCall } from '../utils/api';
import './Booking.css';

const ROLE_NAMES = { student: 'Student', faculty: 'Faculty / Staff', outsider: 'Outsider (commercial)', admin: 'Admin' };

function BookingForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const facilityId = params.get('facility_id');
  const date = params.get('date');
  const start = params.get('start');
  const end = params.get('end');

  const [facility, setFacility] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiCall('/facilities')
      .then((all) => setFacility(all.find((f) => f.id === Number(facilityId)) || null))
      .catch(() => {});
  }, [facilityId]);

  if (!facilityId || !date || !start || !end) {
    return (
      <main className="main">
        <p>No slot selected. <Link to="/facilities">Choose a facility</Link> and pick a slot first.</p>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="main">
        <p>Please <Link to="/login">sign in</Link> to book a slot.</p>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setConflict(false);
    setSubmitting(true);
    try {
      const data = await apiCall('/bookings', 'POST', {
        user_id: user.id,
        facility_id: Number(facilityId),
        booking_date: date,
        start_time: start,
        end_time: end,
        purpose,
      });
      navigate('/booking-confirmed', {
        state: {
          bookingId: data.booking.id,
          facility: facility ? facility.name : `Facility ${facilityId}`,
          date, start, end,
          role: user.role,
        },
      });
    } catch (requestError) {
      if (requestError.status === 409) {
        setConflict(true);
      } else {
        setError(requestError.message || 'Booking failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="main">
      <h1 className="title">Facility Booking Request</h1>

      {conflict && (
        <div className="conflict-box">
          <strong>Booking conflict detected.</strong> This slot was just booked by someone else.{' '}
          <Link to={`/facilities/${facilityId}?date=${date}`}>Back to availability</Link> to pick another slot.
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="booking-layout">
        <aside className="summary-card">
          <h3>Booking Summary</h3>
          <div className="summary-label">FACILITY</div>
          <div className="summary-value">{facility ? facility.name : '…'}</div>
          <div className="summary-label">DATE &amp; TIME</div>
          <div className="summary-value">{prettyDate(date)}</div>
          <div>{start} – {end}</div>
          <div className="summary-label">BOOKED BY</div>
          <div className="summary-value">{ROLE_NAMES[user.role] || user.role}</div>
        </aside>

        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Confirm your details</h2>
          <div className="form-grid">
            <label className="form-field">Full name<input value={user.full_name} readOnly /></label>
            <label className="form-field">Email<input value={user.email} readOnly /></label>
          </div>
          <label className="form-field">
            Purpose of booking
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
          </label>
          <label className="agree-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            I agree to the college rules and guidelines set by the Office of the Dean of Student Affairs.
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || !agree}>
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default BookingForm;