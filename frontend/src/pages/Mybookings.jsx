import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import { todayString } from '../utils/slots';
import './Mybookings.css';

const PORTAL_TITLES = { student: 'Student Booking Portal', faculty: 'Faculty Booking Portal' };

function bookingStatus(booking, today) {
  if (booking.status === 'cancelled') return 'Cancelled';
  if (booking.booking_date < today) return 'Completed';
  if (booking.status === 'approved') return 'Confirmed';
  if (booking.status === 'pending') return 'Pending approval';
  return booking.status;
}

// '2026-10-25' -> '25 Oct 2026'
function shortDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// '15:00' -> '03:00 PM'
function time12(value) {
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const FILTERS = [
  ['all', 'All'],
  ['upcoming', 'Upcoming'],
  ['past', 'Past & cancelled'],
];

function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadBookings = useCallback(async () => {
    if (!user) return;
    try {
      const result = await apiCall(`/bookings/user/${user.id}`);
      setBookings(result);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBookings();
    const refreshInterval = window.setInterval(loadBookings, 30000);
    window.addEventListener('focus', loadBookings);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', loadBookings);
    };
  }, [loadBookings]);

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
  const isUpcoming = (booking) => booking.status !== 'cancelled' && booking.booking_date >= today;
  const upcomingCount = bookings.filter(isUpcoming).length;
  const confirmedCount = bookings.filter((booking) => booking.status === 'approved').length;
  const visibleBookings = bookings.filter((booking) => {
    if (filter === 'upcoming') return isUpcoming(booking);
    if (filter === 'past') return !isUpcoming(booking);
    return true;
  });

  return (
    <main className="main my-bookings">
      <div className="my-bookings-heading">
        <div>
          <h1 className="title">{PORTAL_TITLES[user?.role] || 'Booking Portal'}</h1>
          <p className="subtitle">View schedules, cancellations, and your reservation history.</p>
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
          <strong>{upcomingCount} Active</strong>
        </article>
        <article className="my-bookings-stat">
          <span>Confirmed Bookings</span>
          <strong>{confirmedCount} {confirmedCount === 1 ? 'Game' : 'Games'}</strong>
        </article>
      </section>

      <section className="my-bookings-reservations">
        <div className="my-bookings-toolbar">
          <h2>Recent &amp; Upcoming Reservations</h2>
          <div className="my-bookings-filters" role="group" aria-label="Filter reservations">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filter === key ? 'active' : ''}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="my-bookings-empty">Loading your bookings…</p>}
        {!loading && bookings.length === 0 && (
          <p className="my-bookings-empty">
            No bookings yet. <Link to="/facilities">Browse facilities to book a session.</Link>
          </p>
        )}
        {!loading && bookings.length > 0 && visibleBookings.length === 0 && (
          <p className="my-bookings-empty">Nothing to show in this view.</p>
        )}
        {!loading && visibleBookings.length > 0 && (
          <div className="my-bookings-table-wrap">
            <table className="my-bookings-table">
              <thead>
                <tr>
                  <th scope="col">Booking ID</th>
                  <th scope="col">Facility</th>
                  <th scope="col">Date &amp; Time</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="my-bookings-actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => {
                  const status = bookingStatus(booking, today);
                  const canCancel = status === 'Confirmed';
                  const statusClass = status.toLowerCase().replaceAll(' ', '-');

                  return (
                    <tr key={booking.id}>
                      <td className="my-bookings-id" data-label="Booking ID">B-{booking.id}</td>
                      <td className="my-bookings-facility" data-label="Facility">{booking.facility_name}</td>
                      <td data-label="Date & Time">
                        <span className="my-bookings-date">{shortDate(booking.booking_date)}</span>
                        <span className="my-bookings-time">{time12(booking.start_time)} – {time12(booking.end_time)}</span>
                      </td>
                      <td data-label="Status"><span className={`my-bookings-status ${statusClass}`}>{status}</span></td>
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
