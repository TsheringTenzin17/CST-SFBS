import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import { prettyDate } from '../utils/format';
import { todayString } from '../utils/slots';
import './Mybookings.css';

function bookingStatus(booking, today) {
  if (booking.status === 'cancelled') return 'Cancelled';
  if (booking.booking_date < today) return 'Completed';
  if (booking.status === 'approved') return 'Confirmed';
  if (booking.status === 'pending') return 'Pending approval';
  return booking.status;
}

function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);
  const [message, setMessage] = useState(null);

  async function loadBookings() {
    if (!user) return;
    try {
      const result = await apiCall(`/bookings/user/${user.id}`);
      setBookings(result);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [user]);

  async function handleCancel(booking) {
    if (!window.confirm(`Cancel booking B-${booking.id}?`)) return;

    setCancelingId(booking.id);
    setMessage(null);
    try {
      await apiCall(`/bookings/${booking.id}/cancel`, 'PATCH');
      navigate('/booking-cancelled', {
        state: {
          bookingId: booking.id,
          facility: booking.facility_name,
          date: booking.booking_date,
          start: booking.start_time,
          end: booking.end_time,
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCancelingId(null);
    }
  }

  const today = todayString();
  const upcomingCount = bookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.booking_date >= today
  ).length;
  const confirmedCount = bookings.filter((booking) => booking.status === 'approved').length;

  return (
    <main className="main my-bookings">
      <div className="my-bookings-heading">
        <div>
          <h1 className="title">Student Booking Portal</h1>
          <p className="subtitle">View your reservations and manage upcoming sessions.</p>
        </div>
        <Link className="my-bookings-book-button" to="/facilities">+ Book New Session</Link>
      </div>

      {message && (
        <div className={`my-bookings-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      <section className="my-bookings-stats" aria-label="Booking summary">
        <article className="my-bookings-stat">
          <span>Total Bookings</span>
          <strong>{bookings.length}</strong>
        </article>
        <article className="my-bookings-stat">
          <span>Upcoming Bookings</span>
          <strong className="upcoming">{upcomingCount} Active</strong>
        </article>
        <article className="my-bookings-stat">
          <span>Confirmed Bookings</span>
          <strong className="confirmed">{confirmedCount}</strong>
        </article>
      </section>

      <section className="my-bookings-reservations">
        <h2>Recent &amp; Upcoming Reservations</h2>
        {loading && <p className="my-bookings-empty">Loading your bookings…</p>}
        {!loading && bookings.length === 0 && (
          <p className="my-bookings-empty">
            No bookings yet. <Link to="/facilities">Browse facilities to book a session.</Link>
          </p>
        )}
        {!loading && bookings.length > 0 && (
          <div className="my-bookings-table-wrap">
            <table className="my-bookings-table">
              <thead>
                <tr>
                  <th scope="col">Booking ID</th>
                  <th scope="col">Facility</th>
                  <th scope="col">Date &amp; Time</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const status = bookingStatus(booking, today);
                  const canCancel = status === 'Confirmed';
                  const statusClass = status.toLowerCase().replaceAll(' ', '-');

                  return (
                    <tr key={booking.id}>
                      <td className="my-bookings-id">B-{booking.id}</td>
                      <td className="my-bookings-facility">{booking.facility_name}</td>
                      <td>
                        <span>{prettyDate(booking.booking_date)}</span>
                        <span className="my-bookings-time">{booking.start_time} – {booking.end_time}</span>
                      </td>
                      <td><span className={`my-bookings-status ${statusClass}`}>{status}</span></td>
                      <td className="my-bookings-actions">
                        {canCancel && (
                          <Link className="my-bookings-reschedule" to={`/my-bookings/${booking.id}/reschedule`}>
                            Reschedule
                          </Link>
                        )}
                        {canCancel && (
                          <button
                            className="my-bookings-cancel"
                            type="button"
                            onClick={() => handleCancel(booking)}
                            disabled={cancelingId === booking.id}
                          >
                            {cancelingId === booking.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default MyBookings;
