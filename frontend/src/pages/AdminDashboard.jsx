import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AdminReports from './AdminReports';
import AdminUsers from './AdminUsers';
import AdminMaintenance from './AdminMaintenance';
import AdminSupport from './AdminSupport';
import { apiCall } from '../utils/api';
import './admin.css';

const navigation = [
  'Bookings',
  'Maintenance Blocks',
  'Users',
  'Support Requests',
  'Reports',
];

const CHART_COLORS = ['#0755b6', '#24a148', '#f59e0b', '#8b5cf6', '#ef4444', '#06a6a6'];

function formatDate(value) {
  return String(value || '').slice(0, 10) || '—';
}

function formatTime(value) {
  return String(value || '').slice(0, 5) || '—';
}

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('Bookings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingBooking, setEditingBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [actionError, setActionError] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiCall('/bookings');
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
  const lastUsageDate = new Date();
  lastUsageDate.setHours(0, 0, 0, 0);
  const weekStart = new Date(lastUsageDate);
  weekStart.setDate(weekStart.getDate() - 6);
  const usage = bookingList.reduce((counts, booking) => {
    const bookingDate = new Date(`${booking.booking_date}T00:00:00`);
    if (
      booking.status !== 'cancelled' &&
      booking.facility_name &&
      !Number.isNaN(bookingDate.getTime()) &&
      bookingDate >= weekStart &&
      bookingDate <= lastUsageDate
    ) {
      counts[booking.facility_name] = (counts[booking.facility_name] || 0) + 1;
    }
    return counts;
  }, {});
  const usageRows = Object.entries(usage).sort((a, b) => b[1] - a[1]);
  const usageTotal = usageRows.reduce((total, [, count]) => total + count, 0);
  let chartOffset = 0;
  const chartStops = usageRows.map(([, count], index) => {
    const start = chartOffset;
    chartOffset += (count / usageTotal) * 100;
    return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${chartOffset}%`;
  });
  const visibleBookings = bookingList.filter((booking) =>
    (!facilityFilter || booking.facility_name === facilityFilter) &&
    (!statusFilter || booking.status === statusFilter) &&
    (!dateFilter || booking.booking_date === dateFilter)
  );

  async function saveReschedule(event) {
    event.preventDefault();
    setActionError('');
    setSavingAction(true);
    try {
      await apiCall(`/bookings/${editingBooking.id}/reschedule`, 'PATCH', {
        booking_date: editingBooking.booking_date,
        start_time: editingBooking.start_time,
        end_time: editingBooking.end_time,
      });
      setEditingBooking(null);
      await loadBookings();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSavingAction(false);
    }
  }

  async function saveCancellation(event) {
    event.preventDefault();
    setActionError('');
    if (!cancelBooking.reason.trim()) {
      setActionError('Please enter a cancellation reason.');
      return;
    }
    setSavingAction(true);
    try {
      await apiCall(`/bookings/${cancelBooking.id}`, 'PATCH', {
        status: 'cancelled',
        reason: cancelBooking.reason.trim(),
      });
      setCancelBooking(null);
      await loadBookings();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSavingAction(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">A</span>
          <span>Admin Control</span>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map((item) => (
            <button
              aria-current={activeTab === item ? 'page' : undefined}
              className={`admin-nav-item${activeTab === item ? ' is-active' : ''}`}
              key={item}
              onClick={() => setActiveTab(item)}
              type="button"
            >
              <span>{item}</span>
            </button>
          ))}
          <button className="admin-nav-item admin-logout" onClick={handleLogout} type="button">
            Sign out
          </button>
        </nav>
      </aside>

      <main className="admin-content">
        <header className="admin-page-header">
          <div>
            <h1>{activeTab}</h1>
            <p>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}. Here’s the latest on your sports facilities.</p>
          </div>
        </header>

        {activeTab === 'Bookings' && <>
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

        <section className="admin-panel admin-usage-panel" aria-label="Facility usage overview for the last 7 days">
          <div className="admin-panel-heading">
            <h2>Facility Usage Overview</h2>
            <span>Last 7 days</span>
          </div>
          {usageRows.length > 0 ? (
            <div className="admin-usage-content">
              <div
                className="admin-usage-pie"
                role="img"
                aria-label={`Pie chart showing ${usageTotal} bookings across ${usageRows.length} facilities`}
                style={{ background: `conic-gradient(${chartStops.join(', ')})` }}
              />
              <ul className="admin-usage-legend">
                {usageRows.map(([name, count], index) => (
                  <li key={name}>
                    <span className="admin-usage-color" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="admin-usage-name">{name}</span>
                    <strong>{count}</strong>
                    <span className="admin-usage-percent">{Math.round((count / usageTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="admin-state-message">No facility bookings in the last 7 days.</p>
          )}
        </section>

        <section className="admin-panel admin-bookings-panel">
          <div className="admin-panel-heading">
            <h2>Bookings</h2>
            <button className="admin-secondary-button" onClick={loadBookings} type="button">Refresh</button>
          </div>

          {error && (
            <div className="admin-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={loadBookings}>Try again</button>
            </div>
          )}

          <div className="admin-booking-filters" aria-label="Filter bookings">
            <label>Facility
              <select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}>
                <option value="">All facilities</option>
                {[...new Set(bookingList.map((booking) => booking.facility_name).filter(Boolean))].sort().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {[...new Set(bookingList.map((booking) => booking.status).filter(Boolean))].sort().map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>Date
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </label>
            <button className="admin-secondary-button" onClick={() => { setFacilityFilter(''); setStatusFilter(''); setDateFilter(''); }} type="button">Clear filters</button>
          </div>

          {actionError && <div className="admin-error" role="alert">{actionError}</div>}

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
                  {visibleBookings.length === 0 ? (
                    <tr><td className="admin-empty-state" colSpan="8">{bookingList.length ? 'No bookings match these filters.' : 'No bookings yet.'}</td></tr>
                  ) : (
                    visibleBookings.map((booking) => (
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
                          {booking.status !== 'cancelled' && <div className="admin-row-actions">
                            <button className="admin-secondary-button" onClick={() => {
                              setActionError('');
                              setCancelBooking(null);
                              setEditingBooking({
                                id: booking.id,
                                booking_date: booking.booking_date,
                                start_time: booking.start_time,
                                end_time: booking.end_time,
                              });
                            }} type="button">Reschedule</button>
                            <button className="admin-cancel-button" onClick={() => {
                              setActionError('');
                              setEditingBooking(null);
                              setCancelBooking({ id: booking.id, reason: '' });
                            }} type="button">Cancel</button>
                          </div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {editingBooking && <form className="admin-action-form" onSubmit={saveReschedule}>
            <h3>Reschedule booking {editingBooking.id}</h3>
            <label>Date<input required type="date" value={editingBooking.booking_date} onChange={(event) => setEditingBooking({ ...editingBooking, booking_date: event.target.value })} /></label>
            <label>Start time<input required type="time" value={editingBooking.start_time} onChange={(event) => setEditingBooking({ ...editingBooking, start_time: event.target.value })} /></label>
            <label>End time<input required type="time" value={editingBooking.end_time} onChange={(event) => setEditingBooking({ ...editingBooking, end_time: event.target.value })} /></label>
            <button className="admin-primary-button" disabled={savingAction} type="submit">{savingAction ? 'Saving…' : 'Save reschedule'}</button>
            <button className="admin-secondary-button" onClick={() => setEditingBooking(null)} type="button">Close</button>
          </form>}
          {cancelBooking && <form className="admin-action-form" onSubmit={saveCancellation}>
            <h3>Cancel booking {cancelBooking.id}</h3>
            <label>Reason<textarea required value={cancelBooking.reason} onChange={(event) => setCancelBooking({ ...cancelBooking, reason: event.target.value })} /></label>
            <button className="admin-cancel-button" disabled={savingAction} type="submit">{savingAction ? 'Cancelling…' : 'Confirm cancellation'}</button>
            <button className="admin-secondary-button" onClick={() => setCancelBooking(null)} type="button">Close</button>
          </form>}
        </section>
        </>}

        {activeTab === 'Maintenance Blocks' && <section className="admin-panel admin-tab-panel">
          <div className="admin-panel-heading"><h2>Maintenance Blocks</h2></div>
          <AdminMaintenance />
        </section>}

        {activeTab === 'Users' && <section className="admin-panel admin-tab-panel">
          <div className="admin-panel-heading"><h2>Registered Users</h2></div>
          <AdminUsers />
        </section>}

        {activeTab === 'Reports' && <section className="admin-panel admin-tab-panel">
          <div className="admin-panel-heading"><h2>Reports &amp; Analytics</h2></div>
          <AdminReports />
        </section>}

        {activeTab === 'Support Requests' && <section className="admin-panel admin-tab-panel">
          <div className="admin-panel-heading"><h2>Support Requests</h2></div>
          <AdminSupport />
        </section>}
      </main>
    </div>
  );
}

export default AdminDashboard;
