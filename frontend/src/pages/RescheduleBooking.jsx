import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import { prettyDate } from '../utils/format';
import { buildSlots, slotState, todayString, toMin } from '../utils/slots';
import './RescheduleBooking.css';

function RescheduleBooking() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [facility, setFacility] = useState(null);
  const [date, setDate] = useState('');
  const [availability, setAvailability] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiCall(`/bookings/user/${user.id}`),
      apiCall('/facilities'),
    ])
      .then(([userBookings, facilities]) => {
        if (!active) return;
        const current = userBookings.find((item) => item.id === Number(id));
        if (!current || current.status !== 'approved' || current.booking_date < todayString()) {
          setError('Only your upcoming confirmed bookings can be rescheduled.');
          return;
        }
        const matchingFacility = facilities.find((item) => item.id === current.facility_id);
        if (!matchingFacility) {
          setError('The facility for this booking could not be found.');
          return;
        }
        setBooking(current);
        setFacility(matchingFacility);
        setDate(current.booking_date);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, user.id]);

  useEffect(() => {
    if (!booking || !facility || !date) return undefined;
    let active = true;
    setAvailability(null);
    setAvailabilityLoading(true);
    setSelectedSlot(null);
    apiCall(`/facilities/${facility.id}/availability?date=${date}`)
      .then((result) => { if (active) setAvailability(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [booking, facility, date]);

  const duration = booking ? toMin(booking.end_time) - toMin(booking.start_time) : 0;
  const availableSlots = availability && user
    ? buildSlots(availability.rules, duration).filter(
      (slot) => slotState(slot, { date, availability, user }) === 'open'
    )
    : [];

  async function handleSubmit(event) {
    event.preventDefault();
    if (!booking || !selectedSlot) return;

    setError(null);
    setSubmitting(true);
    try {
      const result = await apiCall(`/bookings/${booking.id}/reschedule-request`, 'PATCH', {
        booking_date: date,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        reason,
      });
      setBooking({ ...booking, ...result.booking });
      setSuccess(`Booking B-${booking.id} has been moved to ${prettyDate(date)} at ${selectedSlot.start}–${selectedSlot.end}.`);
      setSelectedSlot(null);
      setReason('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="main reschedule-page"><p role="status">Loading booking…</p></main>;
  }

  if (error && !booking) {
    return (
      <main className="main reschedule-page">
        <h1 className="title">Reschedule Your Booking</h1>
        <p className="error" role="alert">{error}</p>
        <Link to="/my-bookings">Back to My Bookings</Link>
      </main>
    );
  }

  if (!booking || !facility) return null;

  return (
    <main className="main reschedule-page">
      <Link className="reschedule-back" to="/my-bookings">← My Bookings</Link>
      <h1 className="title">Reschedule Your Booking</h1>
      <p className="subtitle">Choose a new available slot for your reservation.</p>

      {error && <p className="reschedule-alert error" role="alert">{error}</p>}
      {success && (
        <div className="reschedule-alert success" role="status">
          <strong>Reschedule confirmed.</strong> {success}
          <Link to="/my-bookings">Return to My Bookings</Link>
        </div>
      )}

      <section className="reschedule-current">
        <h2>Current Booking Details</h2>
        <dl>
          <div><dt>Booking ID</dt><dd>B-{booking.id}</dd></div>
          <div><dt>Facility</dt><dd>{facility.name}</dd></div>
          <div><dt>Current schedule</dt><dd>{prettyDate(booking.booking_date)} · {booking.start_time}–{booking.end_time}</dd></div>
        </dl>
      </section>

      {!success && (
        <form className="reschedule-form" onSubmit={handleSubmit}>
          <div className="reschedule-slot-heading">
            <div>
              <h2>Select New Schedule Slot</h2>
              <p>Only slots currently available to your account are shown.</p>
            </div>
            <label className="reschedule-date">
              Booking date
              <input
                type="date"
                value={date}
                min={todayString()}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
          </div>

          {availability?.maintenance?.length > 0 && (
            <p className="reschedule-empty">This facility is closed for maintenance on this date. Choose another day.</p>
          )}
          {availabilityLoading && <p className="reschedule-empty" role="status">Checking available slots…</p>}
          {!availabilityLoading && availability && availableSlots.length === 0 && (
            <p className="reschedule-empty">No suitable slots are available on this date. Try another date.</p>
          )}
          {!availabilityLoading && availableSlots.length > 0 && (
            <div className="reschedule-slots" role="radiogroup" aria-label="Available time slots">
              {availableSlots.map((slot) => {
                const selected = selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                return (
                  <label className={`reschedule-slot${selected ? ' selected' : ''}`} key={`${slot.start}-${slot.end}`}>
                    <input
                      type="radio"
                      name="slot"
                      checked={selected}
                      onChange={() => setSelectedSlot(slot)}
                    />
                    <span>{slot.start} – {slot.end}</span>
                    <small>Available</small>
                  </label>
                );
              })}
            </div>
          )}

          <label className="reschedule-reason">
            Reason for rescheduling
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Briefly explain why you need to change your booking."
              required
            />
            <small>{reason.length}/500 characters</small>
          </label>

          <div className="reschedule-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/my-bookings')}>
              Cancel
            </button>
            <button
              className="btn-primary"
              type="submit"
              disabled={!selectedSlot || !reason.trim() || submitting || availabilityLoading}
            >
              {submitting ? 'Saving…' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

export default RescheduleBooking;
