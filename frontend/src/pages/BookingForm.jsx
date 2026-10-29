import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { prettyDate } from '../utils/format';
import { apiCall } from '../utils/api';
import ConflictPanel from '../components/ConflictPanel';
import './Booking.css';

const ROLE_NAMES = { student: 'Student', faculty: 'Faculty / Staff', outsider: 'Outsider (commercial)', admin: 'Admin' };
const SPORT_ICONS = { football: '⚽', basketball: '🏀', volleyball: '🏐', badminton: '🏸', table_tennis: '🏓', archery: '🎯' };

function formatTime(value) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function bookingMode(role) {
  if (role === 'student') return 'Student Booking Mode (Free)';
  if (role === 'faculty') return 'Faculty & Staff Booking Mode';
  if (role === 'outsider') return 'Commercial Booking Mode';
  return ROLE_NAMES[role] || role;
}

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
  const [purpose, setPurpose] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState(null);
  const [conflictSlot, setConflictSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountProfile, setAccountProfile] = useState(null);
  const conflict = conflictSlot === slotKey;
  const bookingUser = accountProfile ? { ...user, ...accountProfile } : user;

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
        <aside className="summary-card">
          <div className="summary-heading">
            <h3>Booking Summary</h3>
            <span>{SPORT_ICONS[facility?.type] || '🏟'} <small>{facility?.type === 'football' ? 'Football' : facility?.type || 'Facility'}</small></span>
          </div>
          <div className="summary-section">
            <div className="summary-label">Facility</div>
            <div className="summary-value">{facility ? facility.name : '…'}</div>
          </div>
          <div className="summary-section">
            <div className="summary-label">Date &amp; Time</div>
            <div className="summary-value">{prettyDate(date)}</div>
            <div className="summary-time">{formatTime(start)} – {formatTime(end)}</div>
          </div>
          <div className="summary-section">
            <div className="summary-label">Allocated User Group</div>
            <div className="summary-value">{bookingMode(bookingUser.role)}</div>
          </div>
          <div className="rules-brief">
            <strong>Rules Brief:</strong>
            <ul>
              <li>Valid Student/Faculty ID card must be presented to the security desk on arrival.</li>
              <li>Clean athletic footwear is mandatory on the synthetic turf.</li>
            </ul>
          </div>
        </aside>

        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Facility Booking Request</h2>
          <p className="booking-intro">Please complete the credentials below to submit your scheduling reservation.</p>
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