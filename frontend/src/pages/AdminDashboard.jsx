import { useCallback, useEffect, useState } from 'react';
import './admin.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
// TODO: replace this temporary ID when admin authentication is available.
const ADMIN_USER_ID = 1;

const navigation = [
  { label: 'Dashboard', active: true },
  { label: 'Manage Bookings' },
  { label: 'Facilities Status' },
  { label: 'Registered Users', disabled: true },
  { label: 'Maintenance Blocks', disabled: true },
  { label: 'System Settings', disabled: true },
];

function formatDate(value) {
  const date = String(value || '').slice(0, 10);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

function formatTime(value) {
  return String(value || '').slice(0, 5) || '—';
}

function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/bookings`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load bookings.');
      }
      if (!Array.isArray(data)) {
        throw new Error('The bookings response was not a list.');
      }

      setBookings(data);
    } catch (requestError) {
      setError(requestError.message || 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const bookingList = Array.isArray(bookings) ? bookings : [];
  const activeCount = bookingList.filter((booking) => booking.status === 'approved').length;
  const cancelledCount = bookingList.filter((booking) => booking.status === 'cancelled').length;
  const facilityCount = new Set(
    bookingList.map((booking) => booking.facility_name).filter(Boolean)
  ).size;

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">A</span>
          <span>Admin Control</span>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {Array.isArray(navigation) && navigation.map((item) => (
            <button
              className={`admin-nav-item${item.active ? ' is-active' : ''}${item.disabled ? ' is-disabled' : ''}`}
              disabled={item.disabled}
              key={item.label}
              type="button"
            >
              <span>{item.label}</span>
              {item.disabled && <span className="admin-coming-soon">Coming soon</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="admin-content">
        <header className="admin-page-header">
          <div>
            <h1>System Overview</h1>
            <p>Welcome back. Here’s the latest on your sports facilities.</p>
          </div>
        </header>

        <section className="admin-stats" aria-label="Booking statistics">
          <article className="admin-stat-card">
            <span>Total Bookings</span>
            <strong>{bookingList.length}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Active</span>
            <strong className="admin-stat-blue">{activeCount}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Cancelled</span>
            <strong className="admin-stat-red">{cancelledCount}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Facilities Booked</span>
            <strong className="admin-stat-green">{facilityCount}</strong>
          </article>
        </section>

        <section className="admin-panel admin-bookings-panel">
          <div className="admin-panel-heading">
            <h2>Recent Bookings</h2>
            <span>Newest first</span>
          </div>

          {error && (
            <div className="admin-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={loadBookings}>Try again</button>
            </div>
          )}

          {loading ? (
            <p className="admin-state-message" role="status">Loading bookings…</p>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-bookings-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Requester</th>
                    <th>Facility</th>
                    <th>Role</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingList.length === 0 ? (
                    <tr>
                      <td className="admin-empty-state" colSpan="8">No bookings yet</td>
                    </tr>
                  ) : (
                    bookingList.map((booking) => (
                      <tr key={booking.id}>
                        <td className="admin-booking-id">{booking.id}</td>
                        <td>{booking.user_name || '—'}</td>
                        <td>{booking.facility_name || '—'}</td>
                        <td>
                          <span className={`admin-role-badge role-${String(booking.user_role || 'other').toLowerCase()}`}>
                            {booking.user_role || '—'}
                          </span>
                        </td>
                        <td>{formatDate(booking.booking_date)}</td>
                        <td>{formatTime(booking.start_time)}-{formatTime(booking.end_time)}</td>
                        <td>
                          <span className={`admin-status-badge status-${String(booking.status || 'unknown').toLowerCase()}`}>
                            {booking.status || 'unknown'}
                          </span>
                        </td>
                        <td>
                          {booking.status === 'approved' ? (
                            <button
                              aria-label={`Cancel booking ${booking.id}`}
                              className="admin-cancel-button"
                              disabled
                              title="Cancellation will be available in Step 2"
                              type="button"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;
