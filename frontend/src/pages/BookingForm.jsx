import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { prettyDate } from '../utils/format';
import { apiCall } from '../utils/api';
import { isCommercialBooking, toMin } from '../utils/slots';
import { Spinner } from '../components/Loading';
import ConflictPanel from '../components/ConflictPanel';
import './Booking.css';

const ROLE_NAMES = { student: 'Student', faculty: 'Faculty / Staff', outsider: 'Outsider (commercial)', admin: 'Admin' };

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function bookingMode(role, commercialSlot = false) {
  if (commercialSlot) return { name: 'Commercial Booking Mode', tag: 'Pay offline' };
  if (role === 'student') return { name: 'Student Booking Mode', tag: 'Free' };
  if (role === 'faculty') return { name: 'Faculty & Staff Booking Mode', tag: null };
  if (role === 'outsider') return { name: 'Commercial Booking Mode', tag: 'Pay offline' };
  return { name: ROLE_NAMES[role] || role, tag: null };
}

function sportLabel(type) {
  if (!type) return 'Facility';
  return type.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function footballFee(role, date, assistantReferees = false) {
  if (assistantReferees) {
    if (role === 'student') return 2900;
    if (new Date(`${date}T00:00:00`).getDay() === 0 || new Date(`${date}T00:00:00`).getDay() === 6) return 4400;
    return 3900;
  }

  if (role === 'student') return 2500;
  if (new Date(`${date}T00:00:00`).getDay() === 0 || new Date(`${date}T00:00:00`).getDay() === 6) return 4000;
  return 3500;
}

// Rules shown in the summary card. Football is the only facility on turf.
function rulesFor(type) {
  return [
    'Present a valid Student/Faculty ID card at the security desk on arrival.',
    type === 'football'
      ? 'Clean athletic footwear is mandatory on the synthetic turf.'
      : 'Clean athletic footwear is required on the facility.',
  ];
}

const STEPS = ['Choose slot', 'Your details', 'Confirmation'];

function identityField(role, user) {
  if (role === 'student') {
    return { label: 'Student ID', value: user.student_staff_id };
  }
  if (role === 'faculty' || role === 'admin') {
    return { label: role === 'admin' ? 'Staff Email' : 'Staff Email', value: user.email };
  }
  return { label: 'Organization', value: user.organization };
}

function BookingForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const facilityId = params.get('facility_id');
  const date = params.get('date');
  const start = params.get('start');
  const end = params.get('end');
  const slotKey = JSON.stringify([facilityId, date, start, end]);

  const [facility, setFacility] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);
  const [conflictSlot, setConflictSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountProfile, setAccountProfile] = useState(null);
  const [assistantReferees, setAssistantReferees] = useState(false);
  const conflict = conflictSlot === slotKey;
  const bookingUser = accountProfile ? { ...user, ...accountProfile } : user;
  const selectedRule = availability?.rules?.find((rule) =>
    toMin(rule.start_time) <= toMin(start) &&
    toMin(rule.end_time) >= toMin(end)
  );
  const bookingDetailsLoading = !facility || !availability || !accountProfile;
  const commercialSlot = selectedRule
    ? isCommercialBooking(selectedRule, date, bookingUser)
    : false;
  const requiresPayment = bookingUser?.role === 'outsider' || commercialSlot;
  const footballFeeAmount = requiresPayment && facility?.type === 'football'
    ? footballFee(bookingUser.role, date, assistantReferees)
    : null;

  useEffect(() => {
    apiCall('/facilities')
      .then((all) => {
        setFacilities(all);
        setFacility(all.find((f) => f.id === Number(facilityId)) || null);
      })
      .catch((requestError) => setError(requestError.message));
  }, [facilityId]);

  useEffect(() => {
    apiCall('/auth/profile')
      .then((result) => setAccountProfile(result.profile))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (!facilityId || !date) return;
    apiCall(`/facilities/${facilityId}/availability?date=${date}`)
      .then(setAvailability)
      .catch((requestError) => setError(requestError.message));
  }, [facilityId, date]);

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
    setConflictSlot(null);
    setSubmitting(true);
    try {
      const data = await apiCall('/bookings', 'POST', {
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
          role: bookingUser.role,
          status: data.booking.status,
          commercialSlot,
          footballFee: footballFeeAmount,
          refereeService: assistantReferees ? 'Referee and assistant referees' : 'One referee',
        },
      });
    } catch (requestError) {
      if (requestError.status === 409) {
        // A conflict means availability changed after the user selected the slot; offer fresh alternatives.
        setConflictSlot(slotKey);
      } else {
        setError(requestError.message || 'Booking failed');
      }

    } finally {
      setSubmitting(false);
    }
  }

  if (conflict && facility) {
    const courts = facilities.filter((item) => item.group_name === facility.group_name);
    return (
      <ConflictPanel
        facility={facility}
        courts={courts}
        date={date}
        start={start}
        end={end}
        user={user}
      />
    );
  }

  return (
    <main className="main">
      {conflict && (
        <div className="conflict-box">
          <strong>Booking conflict detected.</strong> This slot was just booked by someone else.{' '}
          <Link to={`/facilities/${facilityId}?date=${date}`}>Back to availability</Link> to pick another slot.
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="booking-layout">
        <ol className="booking-steps" aria-label="Booking progress">
          {STEPS.map((label, index) => (
            <li key={label} className={index === 0 ? 'done' : index === 1 ? 'current' : ''}>
              <span className="step-dot">{index === 0 ? '✓' : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <aside className="summary-card">
          <div className="summary-head">
            <span className="summary-badge">{sportLabel(facility?.type)}</span>
            <div className="summary-label">Facility</div>
            <div className="summary-facility">{facility ? facility.name : '…'}</div>
          </div>
          <div className="summary-body">
            <div className="summary-item">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              <div>
                <div className="summary-label">Date</div>
                <div className="summary-value">{prettyDate(date)}</div>
              </div>
            </div>
            <div className="summary-item">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <div>
                <div className="summary-label">Time</div>
                <div className="summary-value">{formatTime(start)} – {formatTime(end)}</div>
              </div>
            </div>
            {(() => {
              const mode = bookingMode(bookingUser.role, commercialSlot);
              return (
                <div className="summary-group">
                  <div>
                    <div className="summary-label">User group</div>
                    <div className="summary-group-name">{mode.name}</div>
                  </div>
                  {mode.tag && <span className="summary-tag">{mode.tag}</span>}
                </div>
              );
            })()}
            <div className="rules-brief">
              <strong>Rules brief</strong>
              <ul>
                {rulesFor(facility?.type).map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </div>
            {requiresPayment && facility?.type === 'football' && (
              <div className="booking-payment-note">
                <strong>Football booking fee: Nu. {footballFeeAmount.toLocaleString()}</strong>
                <br />
                Pay this facility fee offline before the booking can be approved.
              </div>
            )}
          </div>
        </aside>

        <form className="form-card" onSubmit={handleSubmit} aria-busy={submitting || bookingDetailsLoading}>
          <div className="form-card-heading">
            <span>Booking details</span>
            <h2>Facility Booking Request</h2>
          </div>
          <p className="booking-intro">Complete your details to reserve this slot. Fields marked * are required.</p>
          {(() => {
            const identity = identityField(bookingUser.role, bookingUser);
            return (
              <div className="form-grid">
                <label className="form-field">
                  Full Name <span className="required">*</span>
                  <input value={bookingUser.full_name || ''} readOnly aria-readonly="true" />
                </label>
                <label className="form-field">
                  {identity.label} <span className="required">*</span>
                  <input value={identity.value || 'Not provided'} readOnly aria-readonly="true" title="This value comes from your account profile and cannot be edited here" />
                </label>
              </div>
            );
          })()}
          <div className="form-grid">
            <label className="form-field">Role Type <span className="required">*</span><input value={ROLE_NAMES[bookingUser.role] || bookingUser.role || ''} readOnly aria-readonly="true" /></label>
            <label className="form-field">Contact Number <span className="required">*</span><input value={bookingUser.contact_number || 'Not provided'} readOnly aria-readonly="true" title="This value comes from your account profile and cannot be edited here" /></label>
          </div>
          <label className="form-field">
            Purpose of Booking <span className="required">*</span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Example: Team training practice"
              required
            />
          </label>
          {requiresPayment && facility?.type === 'football' && (
            <label className="form-field">
              Referee Service <span className="required">*</span>
              <select
                value={assistantReferees ? 'assistants' : 'one'}
                onChange={(event) => setAssistantReferees(event.target.value === 'assistants')}
              >
                <option value="one">One referee</option>
                <option value="assistants">Referee and assistant referees</option>
              </select>
            </label>
          )}
          <label className="agree-row">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            I agree to the college rules and guidelines set by the Office of the Dean of Student Affairs.
          </label>
          <div className={`booking-fee-summary${requiresPayment ? ' is-paid' : ''}`} aria-live="polite">
            {bookingDetailsLoading ? (
              <Spinner label="Loading booking fee…" />
            ) : footballFeeAmount !== null ? (
              <>
                <span>{bookingUser.role === 'outsider' ? 'Outsider football fee — pay at the DSA office' : 'Fee to pay at the DSA office'}</span>
                <strong>Nu. {footballFeeAmount.toLocaleString()}</strong>
                <small>{assistantReferees ? 'Referee and assistant referees' : 'One referee'} · offline payment required before approval</small>
              </>
            ) : requiresPayment ? (
              <>
                <span>{bookingUser.role === 'outsider' ? 'Outsider facility fee — payment required' : 'Commercial facility fee'}</span>
                <strong>Confirm amount with the DSA office</strong>
                <small>Ask the DSA office to confirm the amount. Pay offline before your booking can be approved.</small>
              </>
            ) : (
              <>
                <span>Fee to pay</span>
                <strong>No fee — free booking</strong>
              </>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || bookingDetailsLoading || !agree}>
              {submitting
                ? <Spinner label="Confirming…" />
                : bookingDetailsLoading ? <Spinner label="Loading booking details…" /> : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default BookingForm;
