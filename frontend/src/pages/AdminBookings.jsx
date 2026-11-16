import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { clock, shortDay } from '../utils/adminHelpers';
import { AdminLoading, Spinner } from '../components/Loading';
import { buildSlots, isCommercialBooking, isTaken, slotState } from '../utils/slots';

const PAGE_SIZE = 6;
const ROLE_LABEL = {
  student: 'Student',
  faculty: 'Faculty',
  outsider: 'Commercial',
  admin: 'Admin',
};
const STATUS_LABEL = {
  approved: 'Approved',
  pending: 'Pending',
  cancelled: 'Cancelled',
  expired: 'Expired',
  completed: 'Completed',
};

// All booking times are Bhutan time (UTC+6), whatever the admin's browser timezone is.
const BT_OFFSET_MS = 6 * 60 * 60 * 1000;
const bhutanToday = () => new Date(Date.now() + BT_OFFSET_MS).toISOString().slice(0, 10);
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "Completed" is an approved booking whose end time has already passed.
function displayStatus(b) {
  const finished =
    b.status === 'approved' && new Date(`${b.booking_date}T${b.end_time}:00+06:00`) < new Date();
  return finished ? 'completed' : b.status;
}

function slotLabel(b) {
  const today = bhutanToday();
  const day =
    b.booking_date === today
      ? 'Today'
      : b.booking_date === addDays(today, 1)
        ? 'Tomorrow'
        : shortDay(b.booking_date);
  return `${day}, ${clock(b.start_time)} - ${clock(b.end_time)}`;
}

function bookingCreditFee(facilityType, role, date) {
  if (facilityType !== 'football') return 1500;
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  if (role === 'student') return 2500;
  return weekend ? 4000 : 3500;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [facilityFilter, setFacilityFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // modal = { type: 'manage' | 'reject' | 'payment', booking, reschedule?, reason }
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofLoading, setPaymentProofLoading] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [rebookAvailability, setRebookAvailability] = useState(null);
  const [rebookAvailabilityLoading, setRebookAvailabilityLoading] = useState(false);
  const [rebookAvailabilityError, setRebookAvailabilityError] = useState('');
  const bookingDateMin = bhutanToday();
  const bookingDateMax = addDays(bookingDateMin, 6);

  const visibleBookings = bookingList.filter((b) => {
    const status = displayStatus(b);
    const needsPaymentResolution =
      status === 'expired' && b.payment_amount > 0 && !b.payment_resolution_completed_at;
    const statusOk =
      !statusFilter ||
      (statusFilter === 'active'
        ? status === 'pending' || status === 'approved' || needsPaymentResolution
        : status === statusFilter);
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

  useEffect(() => {
    if (modal?.type !== 'payment') {
      setPaymentProof(null);
      setPaymentProofLoading(false);
      return undefined;
    }

    let active = true;
    setPaymentProof(null);
    setPaymentProofLoading(true);
    apiCall(`/bookings/${modal.booking.id}/payment-proof`)
      .then((proof) => {
        if (active) setPaymentProof(proof);
      })
      .catch((e) => {
        if (active) setActionError(e.message);
      })
      .finally(() => {
        if (active) setPaymentProofLoading(false);
      });
    return () => {
      active = false;
    };
  }, [modal?.type, modal?.booking?.id]);

  useEffect(() => {
    if (
      modal?.type !== 'payment' ||
      modal.booking.status !== 'expired' ||
      modal.booking.payment_resolution !== 'credit' ||
      modal.booking.payment_resolution_completed_at
    ) {
      setFacilities([]);
      setFacilitiesLoading(false);
      return undefined;
    }

    let active = true;
    setFacilities([]);
    setFacilitiesLoading(true);
    apiCall('/facilities')
      .then((result) => {
        if (active) setFacilities(result);
      })
      .catch((requestError) => {
        if (active) setActionError(requestError.message);
      })
      .finally(() => {
        if (active) setFacilitiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    modal?.type,
    modal?.booking?.id,
    modal?.booking?.status,
    modal?.booking?.payment_resolution,
    modal?.booking?.payment_resolution_completed_at,
  ]);

  useEffect(() => {
    if (
      modal?.type !== 'payment' ||
      modal.booking.status !== 'expired' ||
      modal.booking.payment_resolution !== 'credit' ||
      modal.booking.payment_resolution_completed_at ||
      modal.rebook?.facility_id ||
      facilitiesLoading
    ) {
      return;
    }

    const originalFacility = facilities.find(
      (facility) => facility.name === modal.booking.facility_name,
    );
    if (!originalFacility) return;
    setModal((current) => {
      if (!current || current.type !== 'payment' || current.rebook?.facility_id) return current;
      return {
        ...current,
        rebook: { ...current.rebook, facility_id: String(originalFacility.id) },
      };
    });
  }, [
    facilities,
    facilitiesLoading,
    modal?.type,
    modal?.booking?.status,
    modal?.booking?.payment_resolution,
    modal?.booking?.payment_resolution_completed_at,
    modal?.booking?.facility_name,
    modal?.rebook?.facility_id,
  ]);

  useEffect(() => {
    if (
      modal?.type !== 'payment' ||
      modal.booking.status !== 'expired' ||
      modal.booking.payment_resolution !== 'credit' ||
      modal.booking.payment_resolution_completed_at ||
      !modal.rebook?.facility_id ||
      !modal.rebook?.booking_date
    ) {
      setRebookAvailability(null);
      setRebookAvailabilityLoading(false);
      setRebookAvailabilityError('');
      return undefined;
    }

    let active = true;
    const facilityId = Number(modal.rebook.facility_id);
    const date = modal.rebook.booking_date;
    setRebookAvailability(null);
    setRebookAvailabilityError('');
    setRebookAvailabilityLoading(true);
    apiCall(`/facilities/${facilityId}/availability?date=${date}`)
      .then((availability) => {
        if (active) setRebookAvailability(availability);
      })
      .catch((requestError) => {
        if (active) setRebookAvailabilityError(requestError.message);
      })
      .finally(() => {
        if (active) setRebookAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    modal?.type,
    modal?.booking?.id,
    modal?.booking?.status,
    modal?.booking?.payment_resolution,
    modal?.booking?.payment_resolution_completed_at,
    modal?.rebook?.facility_id,
    modal?.rebook?.booking_date,
  ]);

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

  function openPaymentReview(b) {
    setActionError('');
    setModal({
      type: 'payment',
      booking: b,
      rebook: {
        facility_id: String(b.facility_id || ''),
        booking_date: '',
        start_time: '',
        end_time: '',
      },
    });
  }

  useEffect(() => {
    const bookingId = location.state?.paymentReviewBookingId;
    if (loading || !bookingId) return;
    const pendingBookings = bookingList.filter((booking) => booking.status === 'pending');
    const bookingIndex = pendingBookings.findIndex((booking) => booking.id === bookingId);
    if (bookingIndex < 0) return;

    setStatusFilter('pending');
    setPage(Math.floor(bookingIndex / PAGE_SIZE) + 1);
    openPaymentReview(pendingBookings[bookingIndex]);
    navigate(location.pathname, { replace: true, state: null });
  }, [bookingList, loading, location.pathname, location.state, navigate]);

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

  const approve = (b, closeAfter = false) =>
    runAction(() => apiCall(`/bookings/${b.id}`, 'PATCH', { status: 'approved' }), closeAfter);

  const completePaymentResolution = (b) =>
    runAction(
      () => apiCall(`/bookings/${b.id}/payment-resolution`, 'PATCH', { completed: true }),
      true,
    );

  function saveReschedule(event) {
    event.preventDefault();
    runAction(
      () => apiCall(`/bookings/${modal.booking.id}/reschedule`, 'PATCH', modal.reschedule),
      true,
    );
  }

  function saveRebook(event) {
    event.preventDefault();
    runAction(
      () =>
        apiCall(`/bookings/${modal.booking.id}/rebook`, 'PATCH', {
          ...modal.rebook,
          facility_id: Number(modal.rebook.facility_id),
        }),
      true,
    );
  }

  // Used by both the Reject button (pending) and the Cancel section of Manage (approved)
  function saveCancellation(event) {
    event.preventDefault();
    if (!modal.reason.trim()) {
      setActionError('Please enter a reason.');
      return;
    }
    runAction(
      () =>
        apiCall(`/bookings/${modal.booking.id}`, 'PATCH', {
          status: 'cancelled',
          reason: modal.reason.trim(),
        }),
      true,
    );
  }

  const setReschedule = (field) => (e) =>
    setModal({ ...modal, reschedule: { ...modal.reschedule, [field]: e.target.value } });
  const setRebook = (field) => (e) => {
    const value = e.target.value;
    setActionError('');
    setModal((current) => {
      const rebook = { ...current.rebook, [field]: value };
      if (field === 'facility_id' || field === 'booking_date') {
        rebook.start_time = '';
        rebook.end_time = '';
      }
      return { ...current, rebook };
    });
  };

  const modalBooking = modal?.booking;
  const modalStatus = modalBooking ? displayStatus(modalBooking) : '';
  const selectedRebookFacility = facilities.find(
    (facility) => facility.id === Number(modal?.rebook?.facility_id),
  );
  const hasRebookAvailability =
    rebookAvailability?.facility_id === Number(modal?.rebook?.facility_id) &&
    rebookAvailability?.date === modal?.rebook?.booking_date;
  const rebookUser = {
    role: modalBooking?.user_role,
    gender: modalBooking?.user_gender,
  };
  const rebookSlots =
    hasRebookAvailability && selectedRebookFacility
      ? buildSlots(
          rebookAvailability.rules,
          selectedRebookFacility.max_duration_minutes || 120,
        )
      : [];
  const recommendedRebookSlots =
    hasRebookAvailability && selectedRebookFacility
      ? rebookSlots.filter(
          (slot) =>
              slotState(slot, {
              date: modal.rebook.booking_date,
              availability: rebookAvailability,
              user: rebookUser,
              }) === 'open' &&
              (rebookUser.role === 'outsider' ||
                isCommercialBooking(slot.rule, modal.rebook.booking_date, rebookUser)) &&
              bookingCreditFee(
                selectedRebookFacility.type,
                rebookUser.role,
                modal.rebook.booking_date,
              ) <= Number(modalBooking.payment_amount),
        )
      : [];
  const rebookSlotAlreadyBooked =
    hasRebookAvailability &&
    modal?.rebook?.start_time &&
    modal?.rebook?.end_time &&
    isTaken(
      { start: modal.rebook.start_time, end: modal.rebook.end_time },
      rebookAvailability.existing_bookings,
    );

  return (
    <div className="bk-page">
      <header className="bk-header">
        <div>
          <h1>Manage Facility Bookings</h1>
          <p>Review, approve, reschedule or cancel campus facility reservations.</p>
        </div>
        <button className="bk-refresh" onClick={onReload} type="button">
          Refresh
        </button>
      </header>

      {error && (
        <div className="admin-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onReload}>
            Try again
          </button>
        </div>
      )}

      <section className="bk-card bk-filters" aria-label="Filter reservations">
        <h2>Filter Reservations</h2>
        <div className="bk-filter-grid">
          <label>
            Facility
            <select value={facilityFilter} onChange={onFilter(setFacilityFilter)}>
              <option value="">All Facilities</option>
              {unique(bookingList, 'facility_name').map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role Type
            <select value={roleFilter} onChange={onFilter(setRoleFilter)}>
              <option value="">All Roles</option>
              {unique(bookingList, 'user_role').map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] || r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={onFilter(setStatusFilter)}>
              <option value="active">Active, Pending &amp; Remedies</option>
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <div className="bk-field">
            <span>Date Range</span>
            <div className="bk-daterange">
              <input
                aria-label="From date"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={onFilter(setFromDate)}
              />
              <input
                aria-label="To date"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={onFilter(setToDate)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bk-card bk-directory">
        <h2>Booking Directory</h2>

        {actionError && !modal && (
          <div className="admin-error" role="alert">
            {actionError}
          </div>
        )}

        {loading ? (
          <AdminLoading label="Loading bookings" rows={5} />
        ) : (
          <div className="admin-table-scroll">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Requester</th>
                  <th>Facility</th>
                  <th>Date &amp; Time Slot</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="bk-th-actions">Actions</th>
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
                        <td className="bk-id" data-label="Booking ID">
                          BK-{b.id}
                        </td>
                        <td className="bk-name" data-label="Requester">
                          {b.user_name || '—'}
                        </td>
                        <td className="bk-facility" data-label="Facility">
                          {b.facility_name || '—'}
                        </td>
                        <td className="bk-slot" data-label="Date & time">
                          {slotLabel(b)}
                        </td>
                        <td data-label="Role">
                          <span className={`bk-badge bk-role-${b.user_role}`}>
                            {ROLE_LABEL[b.user_role] || b.user_role || '—'}
                          </span>
                        </td>
                        <td data-label="Status">
                          <span className={`bk-badge bk-status-${status}`}>
                            {STATUS_LABEL[status] || status}
                          </span>
                          {status === 'expired' && b.payment_amount > 0 && (
                            <small className="bk-resolution-status">
                              {b.payment_resolution_completed_at
                                ? `${b.payment_resolution === 'refund' ? 'Refund' : 'Credit'} processed`
                                : b.payment_resolution
                                  ? `${b.payment_resolution === 'refund' ? 'Refund' : 'Credit'} requested`
                                  : 'Waiting for user choice'}
                            </small>
                          )}
                        </td>
                        <td data-label="Actions">
                          <div className="bk-actions">
                            {status === 'pending' ? (
                              <>
                                <button
                                  className="adm-approve"
                                  disabled={saving}
                                  onClick={() => openPaymentReview(b)}
                                  type="button"
                                >
                                  Review payment
                                </button>
                                <button
                                  className="adm-reject"
                                  disabled={saving}
                                  onClick={() => openReject(b)}
                                  type="button"
                                >
                                  Reject
                                </button>
                              </>
                            ) : status === 'expired' &&
                              b.payment_amount > 0 &&
                              !b.payment_resolution_completed_at ? (
                              <button
                                className="bk-manage"
                                onClick={() => openPaymentReview(b)}
                                type="button"
                              >
                                Review remedy
                              </button>
                            ) : (
                              <button
                                className="bk-manage"
                                onClick={() => openManage(b)}
                                type="button"
                              >
                                Manage
                              </button>
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
            Showing {visibleBookings.length ? firstIndex + 1 : 0}-
            {Math.min(firstIndex + PAGE_SIZE, visibleBookings.length)} of {visibleBookings.length}{' '}
            bookings
          </span>
          <nav className="bk-pager" aria-label="Pagination">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            {pageList(totalPages, currentPage).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="bk-gap">
                  …
                </span>
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
              ),
            )}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </section>

      {modal && (
        <div className="bk-backdrop" onClick={closeModal}>
          <div
            className="bk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bk-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="bk-modal-title">
              {modal.type === 'reject'
                ? 'Reject'
                : modal.type === 'payment'
                  ? 'Review payment'
                  : 'Manage'}{' '}
              booking BK-{modalBooking.id}
            </h3>
            <dl className="bk-summary">
              <div>
                <dt>Requester</dt>
                <dd>{modalBooking.user_name || '—'}</dd>
              </div>
              <div>
                <dt>Facility</dt>
                <dd>{modalBooking.facility_name || '—'}</dd>
              </div>
              <div>
                <dt>Slot</dt>
                <dd>{slotLabel(modalBooking)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[modalStatus] || modalStatus}</dd>
              </div>
            </dl>

            {actionError && (
              <div className="admin-error" role="alert">
                {actionError}
              </div>
            )}

            {modal.type === 'payment' && (
              <section className="bk-payment-review" aria-busy={paymentProofLoading}>
                {paymentProofLoading ? (
                  <AdminLoading label="Loading payment proof" rows={1} />
                ) : paymentProof ? (
                  <>
                    <dl className="bk-summary">
                      <div>
                        <dt>Amount</dt>
                        <dd>Nu. {Number(paymentProof.payment_amount).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Journal number</dt>
                        <dd>{paymentProof.payment_journal_number}</dd>
                      </div>
                      <div>
                        <dt>Payment status</dt>
                        <dd>
                          {paymentProof.payment_verified_at ? 'Verified' : 'Awaiting verification'}
                        </dd>
                      </div>
                    </dl>
                    <a
                      className="bk-payment-image-link"
                      href={paymentProof.payment_screenshot}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="bk-payment-image"
                        src={paymentProof.payment_screenshot}
                        alt={`Payment screenshot for booking BK-${modalBooking.id}`}
                      />
                      <span>Open full-size payment screenshot</span>
                    </a>
                    {modalStatus === 'pending' && (
                      <div className="bk-modal-actions">
                        <button
                          className="admin-primary-button"
                          disabled={saving}
                          onClick={() => approve(modalBooking, true)}
                          type="button"
                        >
                          {saving ? <Spinner label="Approving booking…" /> : 'Verify & approve'}
                        </button>
                        <button
                          className="admin-secondary-button"
                          onClick={closeModal}
                          type="button"
                        >
                          Close
                        </button>
                      </div>
                    )}
                    {modalStatus === 'expired' && (
                      <div className="bk-resolution-review">
                        <h4>Late-review payment remedy</h4>
                        <p>
                          The booking expired because it was not approved before its start time. The
                          DSA handles refunds; a booking credit can be used for a replacement slot
                          agreed with the user.
                        </p>
                        {modalBooking.payment_resolution ? (
                          <>
                            <p>
                              User choice:{' '}
                              <strong>
                                {modalBooking.payment_resolution === 'refund'
                                  ? 'Full refund'
                                  : 'Booking credit'}
                              </strong>
                            </p>
                            {modalBooking.payment_resolution_completed_at ? (
                              <p className="bk-note">This remedy has been marked as processed.</p>
                            ) : modalBooking.payment_resolution === 'refund' ? (
                              <button
                                className="admin-primary-button"
                                disabled={saving}
                                onClick={() => completePaymentResolution(modalBooking)}
                                type="button"
                              >
                                {saving ? (
                                  <Spinner label="Saving payment remedy…" />
                                ) : (
                                  'Mark refund processed'
                                )}
                              </button>
                            ) : (
                              <form className="bk-form" onSubmit={saveRebook}>
                                <h4>Book the user’s preferred replacement slot</h4>
                                <p className="bk-note">
                                  Confirm the preferred facility, date and time with the user first.
                                  The replacement must be within the next 7 days, available to the
                                  user, and cost no more than their credit.
                                </p>
                                <label>
                                  Preferred facility
                                  <select
                                    required
                                    value={modal.rebook?.facility_id ?? ''}
                                    onChange={setRebook('facility_id')}
                                    disabled={facilitiesLoading || facilities.length === 0}
                                  >
                                    <option value="">
                                      {facilitiesLoading ? 'Loading facilities…' : 'Choose a facility'}
                                    </option>
                                    {facilities.map((facility) => (
                                      <option key={facility.id} value={facility.id}>
                                        {facility.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="bk-form-row">
                                  <label>
                                    Preferred date
                                    <input
                                      required
                                      type="date"
                                      min={bookingDateMin}
                                      max={bookingDateMax}
                                      value={modal.rebook?.booking_date ?? ''}
                                      onChange={setRebook('booking_date')}
                                    />
                                  </label>
                                  <label>
                                    Start time
                                    <input
                                      required
                                      type="time"
                                      value={modal.rebook?.start_time ?? ''}
                                      onChange={setRebook('start_time')}
                                    />
                                  </label>
                                  <label>
                                    End time
                                    <input
                                      required
                                      type="time"
                                      value={modal.rebook?.end_time ?? ''}
                                      onChange={setRebook('end_time')}
                                    />
                                  </label>
                                </div>
                                {rebookAvailabilityLoading && (
                                  <p className="bk-slot-status" role="status">
                                    Checking the schedule and current bookings…
                                  </p>
                                )}
                                {rebookAvailabilityError && (
                                  <p className="bk-slot-warning" role="alert">
                                    Could not check availability: {rebookAvailabilityError}
                                  </p>
                                )}
                                {rebookSlotAlreadyBooked && (
                                  <p className="bk-slot-warning" role="alert">
                                    This slot is already booked. Choose one of the recommended open
                                    slots below.
                                  </p>
                                )}
                                {hasRebookAvailability &&
                                  !rebookAvailabilityLoading &&
                                  !rebookAvailabilityError && (
                                    <section
                                      className="bk-slot-recommendations"
                                      aria-label={`Recommended slots for ${ROLE_LABEL[modalBooking.user_role] || modalBooking.user_role}`}
                                    >
                                      <div>
                                        <h5>
                                          Recommended slots for{' '}
                                          {ROLE_LABEL[modalBooking.user_role] ||
                                            modalBooking.user_role}
                                        </h5>
                                        <p>Choose an open slot the user is eligible to book.</p>
                                      </div>
                                      {recommendedRebookSlots.length ? (
                                        <div className="bk-slot-options">
                                          {recommendedRebookSlots.map((slot) => (
                                            <button
                                              key={`${slot.start}-${slot.end}`}
                                              className={
                                                modal.rebook.start_time === slot.start &&
                                                modal.rebook.end_time === slot.end
                                                  ? 'bk-slot-option selected'
                                                  : 'bk-slot-option'
                                              }
                                              onClick={() => {
                                                setActionError('');
                                                setModal((current) => ({
                                                  ...current,
                                                  rebook: {
                                                    ...current.rebook,
                                                    start_time: slot.start,
                                                    end_time: slot.end,
                                                  },
                                                }));
                                              }}
                                              type="button"
                                            >
                                              {clock(slot.start)} – {clock(slot.end)} · Nu.{' '}
                                              {bookingCreditFee(
                                                selectedRebookFacility.type,
                                                rebookUser.role,
                                                modal.rebook.booking_date,
                                              ).toLocaleString()}
                                            </button>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="bk-slot-empty">
                                          No open paid slots for this role fit the credit on this
                                          date. Try another date or facility.
                                        </p>
                                      )}
                                    </section>
                                  )}
                                <div className="bk-modal-actions bk-rebook-actions">
                                  <button
                                    className="admin-primary-button"
                                    disabled={
                                      saving ||
                                      facilitiesLoading ||
                                      facilities.length === 0 ||
                                      rebookAvailabilityLoading ||
                                      rebookSlotAlreadyBooked
                                    }
                                    type="submit"
                                  >
                                    {saving ? (
                                      <Spinner label="Booking replacement slot…" />
                                    ) : (
                                      'Book with credit'
                                    )}
                                  </button>
                                  <button
                                    className="admin-secondary-button"
                                    disabled={saving}
                                    onClick={closeModal}
                                    type="button"
                                  >
                                    Close
                                  </button>
                                </div>
                              </form>
                            )}
                          </>
                        ) : (
                          <p className="bk-note">Waiting for the user to choose a remedy.</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="bk-note">Payment proof is unavailable for this booking.</p>
                )}
              </section>
            )}

            {modal.type === 'manage' &&
              (modalStatus === 'cancelled' || modalStatus === 'completed') && (
                <p className="bk-note">
                  This booking is {modalStatus}, so there is nothing left to change.
                </p>
              )}

            {modal.type === 'manage' && modalStatus === 'approved' && (
              <form className="bk-form" onSubmit={saveReschedule}>
                <h4>Reschedule</h4>
                <div className="bk-form-row">
                  <label>
                    Date
                    <input
                      required
                      type="date"
                      value={modal.reschedule.booking_date}
                      onChange={setReschedule('booking_date')}
                    />
                  </label>
                  <label>
                    Start time
                    <input
                      required
                      type="time"
                      value={modal.reschedule.start_time}
                      onChange={setReschedule('start_time')}
                    />
                  </label>
                  <label>
                    End time
                    <input
                      required
                      type="time"
                      value={modal.reschedule.end_time}
                      onChange={setReschedule('end_time')}
                    />
                  </label>
                </div>
                <button className="admin-primary-button" disabled={saving} type="submit">
                  {saving ? <Spinner label="Saving reschedule…" /> : 'Save reschedule'}
                </button>
              </form>
            )}

            {(modal.type === 'reject' ||
              (modal.type === 'manage' && modalStatus === 'approved')) && (
              <form className="bk-form" onSubmit={saveCancellation}>
                <h4>{modal.type === 'reject' ? 'Reason for rejection' : 'Cancel booking'}</h4>
                <label>
                  Reason (sent to the requester)
                  <textarea
                    required
                    value={modal.reason}
                    onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                  />
                </label>
                <div className="bk-modal-actions">
                  <button className="admin-cancel-button" disabled={saving} type="submit">
                    {saving ? (
                      <Spinner
                        label={
                          modal.type === 'reject' ? 'Rejecting booking…' : 'Cancelling booking…'
                        }
                      />
                    ) : modal.type === 'reject' ? (
                      'Confirm rejection'
                    ) : (
                      'Confirm cancellation'
                    )}
                  </button>
                  <button className="admin-secondary-button" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>
              </form>
            )}

            {modal.type === 'payment' &&
              modalStatus !== 'pending' &&
              !(
                modalStatus === 'expired' &&
                modalBooking.payment_resolution === 'credit' &&
                !modalBooking.payment_resolution_completed_at &&
                paymentProof
              ) && (
              <div className="bk-modal-footer">
                <button className="admin-secondary-button" onClick={closeModal} type="button">
                  Close
                </button>
              </div>
              )}
            {!(
              modal.type === 'reject' ||
              (modal.type === 'manage' && modalStatus === 'approved') ||
              modal.type === 'payment'
            ) && (
              <div className="bk-modal-footer">
                <button className="admin-secondary-button" onClick={closeModal} type="button">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
