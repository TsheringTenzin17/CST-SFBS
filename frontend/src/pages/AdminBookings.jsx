import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { clock, shortDay } from '../utils/adminHelpers';

const PAGE_SIZE = 6;
const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', outsider: 'Commercial', admin: 'Admin' };
const STATUS_LABEL = { approved: 'Approved', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed' };

// All booking times are Bhutan time (UTC+6), whatever the admin's browser timezone is.
const BT_OFFSET_MS = 6 * 60 * 60 * 1000;
const bhutanToday = () => new Date(Date.now() + BT_OFFSET_MS).toISOString().slice(0, 10);
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The database only stores pending / approved / cancelled.
// "Completed" is an approved booking whose end time has already passed.
function displayStatus(b) {
  const finished = b.status === 'approved' && new Date(`${b.booking_date}T${b.end_time}:00+06:00`) < new Date();
  return finished ? 'completed' : b.status;
}

function slotLabel(b) {
  const today = bhutanToday();
  const day = b.booking_date === today ? 'Today' : b.booking_date === addDays(today, 1) ? 'Tomorrow' : shortDay(b.booking_date);
  return `${day}, ${clock(b.start_time)} - ${clock(b.end_time)}`;
}

// [1, 2, '…', 9, 10, 11, '…', 20]
function pageList(total, current) {
  const wanted = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out = [];
  wanted.forEach((p, i) => {
    if (i > 0 && p - wanted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

const unique = (list, key) => [...new Set(list.map((b) => b[key]).filter(Boolean))].sort();

export default function AdminBookings({ bookingList, loading, error, onReload }) {
  const [facilityFilter, setFacilityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // modal = { type: 'manage' | 'reject', booking, reschedule?, reason }
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleBookings = bookingList.filter((b) => {
    const status = displayStatus(b);
    const statusOk =
      !statusFilter ||
      (statusFilter === 'active' ? status === 'pending' || status === 'approved' : status === statusFilter);
    return (
      statusOk &&
      (!facilityFilter || b.facility_name === facilityFilter) &&
      (!roleFilter || b.user_role === roleFilter) &&
      (!fromDate || b.booking_date >= fromDate) &&
      (!toDate || b.booking_date <= toDate)
    );
  });

  const totalPages = Math.max(1, Math.ceil(visibleBookings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visibleBookings.slice(firstIndex, firstIndex + PAGE_SIZE);

  // Changing any filter returns to page 1
  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  function closeModal() {
    setModal(null);
    setActionError('');
  }

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  function openManage(b) {
    setActionError('');
    setModal({
      type: 'manage',
      booking: b,
      reschedule: { booking_date: b.booking_date, start_time: b.start_time, end_time: b.end_time },
      reason: '',
    });
  }

  function openReject(b) {
    setActionError('');
    setModal({ type: 'reject', booking: b, reason: '' });
  }

  async function runAction(request, closeAfter) {
    setActionError('');
    setSaving(true);
    try {
      await request();
      if (closeAfter) setModal(null);
      await onReload();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const approve = (b) =>
    runAction(() => apiCall(`/bookings/${b.id}`, 'PATCH', { status: 'approved' }), false);

  function saveReschedule(event) {
    event.preventDefault();
    runAction(() => apiCall(`/bookings/${modal.booking.id}/reschedule`, 'PATCH', modal.reschedule), true);
  }

  // Used by both the Reject button (pending) and the Cancel section of Manage (approved)
  function saveCancellation(event) {
    event.preventDefault();
    if (!modal.reason.trim()) {
      setActionError('Please enter a reason.');
      return;
    }
    runAction(
      () => apiCall(`/bookings/${modal.booking.id}`, 'PATCH', { status: 'cancelled', reason: modal.reason.trim() }),
      true
    );
  }

  const setReschedule = (field) => (e) =>
    setModal({ ...modal, reschedule: { ...modal.reschedule, [field]: e.target.value } });

  const modalBooking = modal?.booking;
  const modalStatus = modalBooking ? displayStatus(modalBooking) : '';

  return (
    <div className="bk-page">
      <header className="bk-header">
        <div>
          <h1>Manage Facility Bookings</h1>
          <p>Review, approve, reschedule or cancel campus facility reservations.</p>
        </div>
        <button className="bk-refresh" onClick={onReload} type="button">Refresh</button>
      </header>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onReload}>Try again</button>
        </div>
      )}

      <section className="bk-card bk-filters" aria-label="Filter reservations">
        <h2>Filter Reservations</h2>
        <div className="bk-filter-grid">
          <label>Facility
            <select value={facilityFilter} onChange={onFilter(setFacilityFilter)}>
              <option value="">All Facilities</option>
              {unique(bookingList, 'facility_name').map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Role Type
            <select value={roleFilter} onChange={onFilter(setRoleFilter)}>
              <option value="">All Roles</option>
              {unique(bookingList, 'user_role').map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
            </select>
          </label>
          <label>Status
            <select value={statusFilter} onChange={onFilter(setStatusFilter)}>
              <option value="active">Active &amp; Pending</option>
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <div className="bk-field">
            <span>Date Range</span>
            <div className="bk-daterange">
              <input aria-label="From date" type="date" value={fromDate} max={toDate || undefined} onChange={onFilter(setFromDate)} />
              <input aria-label="To date" type="date" value={toDate} min={fromDate || undefined} onChange={onFilter(setToDate)} />
            </div>
          </div>
        </div>
      </section>

      <section className="bk-card bk-directory">
        <h2>Booking Directory</h2>

        {actionError && !modal && <div className="admin-error" role="alert">{actionError}</div>}

        {loading ? (
          <p className="admin-state-message" role="status">Loading bookings…</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Booking ID</th><th>Requester</th><th>Facility</th><th>Date &amp; Time Slot</th>
                  <th>Role</th><th>Status</th><th className="bk-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td className="admin-empty-state" colSpan="7">
                      {bookingList.length ? 'No bookings match these filters.' : 'No bookings yet.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((b) => {
                    const status = displayStatus(b);
                    return (
                      <tr key={b.id}>
                        <td className="bk-id">BK-{b.id}</td>
                        <td className="bk-name">{b.user_name || '—'}</td>
                        <td className="bk-facility">{b.facility_name || '—'}</td>
                        <td className="bk-slot">{slotLabel(b)}</td>
                        <td>
                          <span className={`bk-badge bk-role-${b.user_role}`}>{ROLE_LABEL[b.user_role] || b.user_role || '—'}</span>
                        </td>
                        <td>
                          <span className={`bk-badge bk-status-${status}`}>{STATUS_LABEL[status] || status}</span>
                        </td>
                        <td>
                          <div className="bk-actions">
                            {status === 'pending' ? (
                              <>
                                <button className="adm-approve" disabled={saving} onClick={() => approve(b)} type="button">Approve</button>
                                <button className="adm-reject" disabled={saving} onClick={() => openReject(b)} type="button">Reject</button>
                              </>
                            ) : (
                              <button className="bk-manage" onClick={() => openManage(b)} type="button">Manage</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="bk-footer">
          <span className="bk-count">
            Showing {visibleBookings.length ? firstIndex + 1 : 0}-{Math.min(firstIndex + PAGE_SIZE, visibleBookings.length)} of {visibleBookings.length} bookings
          </span>
          <nav className="bk-pager" aria-label="Pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            {pageList(totalPages, currentPage).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="bk-gap">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={p === currentPage ? 'active' : ''}
                  aria-current={p === currentPage ? 'page' : undefined}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </nav>
        </div>
      </section>

      {modal && (
        <div className="bk-backdrop" onClick={closeModal}>
          <div className="bk-modal" role="dialog" aria-modal="true" aria-labelledby="bk-modal-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="bk-modal-title">
              {modal.type === 'reject' ? 'Reject' : 'Manage'} booking BK-{modalBooking.id}
            </h3>
            <dl className="bk-summary">
              <div><dt>Requester</dt><dd>{modalBooking.user_name || '—'}</dd></div>
              <div><dt>Facility</dt><dd>{modalBooking.facility_name || '—'}</dd></div>
              <div><dt>Slot</dt><dd>{slotLabel(modalBooking)}</dd></div>
              <div><dt>Status</dt><dd>{STATUS_LABEL[modalStatus] || modalStatus}</dd></div>
            </dl>

            {actionError && <div className="admin-error" role="alert">{actionError}</div>}

            {modal.type === 'manage' && (modalStatus === 'cancelled' || modalStatus === 'completed') && (
              <p className="bk-note">This booking is {modalStatus}, so there is nothing left to change.</p>
            )}

            {modal.type === 'manage' && modalStatus === 'approved' && (
              <form className="bk-form" onSubmit={saveReschedule}>
                <h4>Reschedule</h4>
                <div className="bk-form-row">
                  <label>Date<input required type="date" value={modal.reschedule.booking_date} onChange={setReschedule('booking_date')} /></label>
                  <label>Start time<input required type="time" value={modal.reschedule.start_time} onChange={setReschedule('start_time')} /></label>
                  <label>End time<input required type="time" value={modal.reschedule.end_time} onChange={setReschedule('end_time')} /></label>
                </div>
                <button className="admin-primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save reschedule'}</button>
              </form>
            )}

            {(modal.type === 'reject' || (modal.type === 'manage' && modalStatus === 'approved')) && (
              <form className="bk-form" onSubmit={saveCancellation}>
                <h4>{modal.type === 'reject' ? 'Reason for rejection' : 'Cancel booking'}</h4>
                <label>Reason (sent to the requester)
                  <textarea required value={modal.reason} onChange={(e) => setModal({ ...modal, reason: e.target.value })} />
                </label>
                <button className="admin-cancel-button" disabled={saving} type="submit">
                  {saving ? 'Saving…' : modal.type === 'reject' ? 'Confirm rejection' : 'Confirm cancellation'}
                </button>
              </form>
            )}

            <div className="bk-modal-footer">
              <button className="admin-secondary-button" onClick={closeModal} type="button">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
