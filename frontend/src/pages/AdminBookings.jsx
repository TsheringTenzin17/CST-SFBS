import { useState } from 'react';
import { apiCall } from '../utils/api';
import { formatDate, formatTime } from '../utils/adminHelpers';

const unique = (list, key) => [...new Set(list.map((b) => b[key]).filter(Boolean))].sort();

export default function AdminBookings({ bookingList, loading, error, onReload }) {
  const [facilityFilter, setFacilityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingBooking, setEditingBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleBookings = bookingList.filter(
    (b) =>
      (!facilityFilter || b.facility_name === facilityFilter) &&
      (!statusFilter || b.status === statusFilter) &&
      (!dateFilter || b.booking_date === dateFilter)
  );

  function clearFilters() {
    setFacilityFilter('');
    setStatusFilter('');
    setDateFilter('');
  }

  function openReschedule(b) {
    setActionError('');
    setCancelBooking(null);
    setEditingBooking({
      id: b.id,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
    });
  }

  function openCancel(b) {
    setActionError('');
    setEditingBooking(null);
    setCancelBooking({ id: b.id, reason: '' });
  }

  async function runAction(request, onDone) {
    setActionError('');
    setSaving(true);
    try {
      await request();
      onDone();
      await onReload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function saveReschedule(event) {
    event.preventDefault();
    runAction(
      () =>
        apiCall(`/bookings/${editingBooking.id}/reschedule`, 'PATCH', {
          booking_date: editingBooking.booking_date,
          start_time: editingBooking.start_time,
          end_time: editingBooking.end_time,
        }),
      () => setEditingBooking(null)
    );
  }

  function saveCancellation(event) {
    event.preventDefault();
    if (!cancelBooking.reason.trim()) {
      setActionError('Please enter a cancellation reason.');
      return;
    }
    runAction(
      () =>
        apiCall(`/bookings/${cancelBooking.id}`, 'PATCH', {
          status: 'cancelled',
          reason: cancelBooking.reason.trim(),
        }),
      () => setCancelBooking(null)
    );
  }

  const editField = (field) => (e) => setEditingBooking({ ...editingBooking, [field]: e.target.value });

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <h2>Bookings</h2>
        <button className="admin-secondary-button" onClick={onReload} type="button">Refresh</button>
      </div>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onReload}>Try again</button>
        </div>
      )}

      <div className="admin-booking-filters" aria-label="Filter bookings">
        <label>Facility
          <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
            <option value="">All facilities</option>
            {unique(bookingList, 'facility_name').map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {unique(bookingList, 'status').map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Date
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </label>
        <button className="admin-secondary-button" onClick={clearFilters} type="button">Clear filters</button>
      </div>

      {actionError && <div className="admin-error" role="alert">{actionError}</div>}

      {loading ? (
        <p className="admin-state-message" role="status">Loading bookings…</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-bookings-table">
            <thead>
              <tr>
                <th>ID</th><th>Requester</th><th>Facility</th><th>Role</th>
                <th>Date</th><th>Time</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleBookings.length === 0 ? (
                <tr>
                  <td className="admin-empty-state" colSpan="8">
                    {bookingList.length ? 'No bookings match these filters.' : 'No bookings yet.'}
                  </td>
                </tr>
              ) : (
                visibleBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="admin-booking-id">{b.id}</td>
                    <td>{b.user_name || '—'}</td>
                    <td>{b.facility_name || '—'}</td>
                    <td>
                      <span className={`admin-role-badge role-${String(b.user_role || 'other').toLowerCase()}`}>
                        {b.user_role || '—'}
                      </span>
                    </td>
                    <td>{formatDate(b.booking_date)}</td>
                    <td>{formatTime(b.start_time)}-{formatTime(b.end_time)}</td>
                    <td>
                      <span className={`admin-status-badge status-${String(b.status || 'unknown').toLowerCase()}`}>
                        {b.status || 'unknown'}
                      </span>
                    </td>
                    <td>
                      {b.status !== 'cancelled' && (
                        <div className="admin-row-actions">
                          <button className="admin-secondary-button" onClick={() => openReschedule(b)} type="button">Reschedule</button>
                          <button className="admin-cancel-button" onClick={() => openCancel(b)} type="button">Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingBooking && (
        <form className="admin-action-form" onSubmit={saveReschedule}>
          <h3>Reschedule booking {editingBooking.id}</h3>
          <label>Date<input required type="date" value={editingBooking.booking_date} onChange={editField('booking_date')} /></label>
          <label>Start time<input required type="time" value={editingBooking.start_time} onChange={editField('start_time')} /></label>
          <label>End time<input required type="time" value={editingBooking.end_time} onChange={editField('end_time')} /></label>
          <button className="admin-primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save reschedule'}</button>
          <button className="admin-secondary-button" onClick={() => setEditingBooking(null)} type="button">Close</button>
        </form>
      )}

      {cancelBooking && (
        <form className="admin-action-form" onSubmit={saveCancellation}>
          <h3>Cancel booking {cancelBooking.id}</h3>
          <label>Reason
            <textarea required value={cancelBooking.reason} onChange={(e) => setCancelBooking({ ...cancelBooking, reason: e.target.value })} />
          </label>
          <button className="admin-cancel-button" disabled={saving} type="submit">{saving ? 'Cancelling…' : 'Confirm cancellation'}</button>
          <button className="admin-secondary-button" onClick={() => setCancelBooking(null)} type="button">Close</button>
        </form>
      )}
    </section>
  );
}