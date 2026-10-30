// =============================================================
// frontend/src/pages/AdminUserDetail.jsx  —  /admin/users/:id  ("User Account Detail")
// =============================================================
// Opened from Registered Users -> Edit. Edit the account's details and role,
// suspend / reactivate it, and see a summary of its bookings.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { clock } from '../utils/adminHelpers';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty / Staff' },
  { value: 'outsider', label: 'Outsider' },
  { value: 'admin', label: 'Admin' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

function dayName(dateStr) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

function bookingState(b) {
  if (b.status === 'cancelled') return { label: 'Cancelled', cls: 'bad' };
  if (b.status === 'pending') return { label: 'Pending', cls: 'warn' };
  return b.is_completed ? { label: 'Completed', cls: 'good' } : { label: 'Upcoming', cls: 'info' };
}

function AdminUserDetail({ userId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const toForm = (u) => ({
    full_name: u.full_name || '',
    email: u.email || '',
    contact_number: u.contact_number || '',
    student_staff_id: u.student_staff_id || '',
    role: u.role,
    is_active: u.is_active !== false,
  });

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const result = await apiCall(`/admin/users/${userId}`);
      setData(result);
      setForm(toForm(result.user));
    } catch (e) {
      setLoadError(e.message || 'Could not load this user.');
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setMessage(null);
  }

  // `override` lets the Deactivate button save right away with its own value.
  async function save(override = {}) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiCall(`/admin/users/${userId}`, 'PATCH', { ...form, ...override });
      setData((d) => ({ ...d, user: result.user }));
      setForm(toForm(result.user));
      setMessage({ type: 'success', text: 'Changes saved.' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  function toggleAccount() {
    const next = !form.is_active;
    const ok = window.confirm(next
      ? `Reactivate ${data.user.full_name}?`
      : `Deactivate ${data.user.full_name}? They will not be able to sign in or book until reactivated.`);
    if (ok) save({ is_active: next });
  }

  if (loadError) {
    return (
      <section className="admin-panel">
        <div className="error">{loadError}</div>
        <Link to="/admin/users" className="usr-back">← Back to Registered Users</Link>
      </section>
    );
  }
  if (!data || !form) return <p className="admin-state-message" role="status">Loading user…</p>;

  const { user, summary, bookings } = data;
  const active = user.is_active !== false;

  return (
    <div className="ud-page">
      <Link to="/admin/users" className="usr-back">← Back to Registered Users</Link>

      <header className="ud-head">
        <div>
          <h1>User Account Detail</h1>
          <p>View profile activity, update permissions, and manage account access.</p>
        </div>
        <button type="button" className="ud-save" onClick={() => save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </header>

      {message && <div className={message.type === 'error' ? 'error' : 'success-box'}>{message.text}</div>}

      <section className="ud-card ud-identity">
        <div className="ud-avatar" aria-hidden="true">{initials(user.full_name)}</div>
        <h2>{user.full_name}</h2>
        <p className="ud-sub">USR-{String(user.id).padStart(4, '0')} · {ROLE_LABEL[user.role] || user.role} account</p>
        <span className={`ud-badge ${active ? 'is-active' : 'is-suspended'}`}>{active ? 'Active' : 'Suspended'}</span>
      </section>

      <section className="ud-card">
        <h2>Personal Information</h2>
        <div className="ud-grid">
          <label>Full Name
            <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
          </label>
          <label>Email Address
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </label>
          <label>Contact Number
            <input value={form.contact_number} onChange={(e) => update('contact_number', e.target.value)} />
          </label>
          <label>Student Number
            <input value={form.student_staff_id} onChange={(e) => update('student_staff_id', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="ud-card">
        <h2>Role &amp; Account Status</h2>
        <label className="ud-field">User Role
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <p className="ud-hint">Student · Faculty / Staff · Outsider · Admin</p>

        <div className="ud-toggle-row">
          <div>
            <strong>Account active</strong>
            <span>User can sign in and book facilities.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            aria-label="Account active"
            className={`ud-switch ${form.is_active ? 'on' : ''}`}
            onClick={() => update('is_active', !form.is_active)}
          />
        </div>
        <button type="button" className={`ud-deactivate ${active ? '' : 'is-reactivate'}`} onClick={toggleAccount} disabled={saving}>
          {active ? 'Deactivate Account' : 'Reactivate Account'}
        </button>
      </section>

      <section className="ud-card">
        <h2>Booking History Summary</h2>
        <div className="ud-stats">
          <div><span>Total bookings</span><strong>{summary.total}</strong></div>
          <div><span>Completed</span><strong>{summary.completed}</strong></div>
          <div><span>Cancelled</span><strong>{summary.cancelled}</strong></div>
          <div><span>Upcoming</span><strong>{summary.upcoming}</strong></div>
        </div>
        {bookings.length === 0 ? (
          <p className="admin-empty-state">This user has no bookings yet.</p>
        ) : (
          <div className="ud-bookings">
            {bookings.map((b) => {
              const state = bookingState(b);
              return (
                <div className="ud-booking-row" key={b.id}>
                  <strong>BKG-{String(b.id).padStart(4, '0')}</strong>
                  <span>{b.facility_name}</span>
                  <span className="ud-when">{dayName(b.booking_date)} {b.booking_date.slice(5)}, {clock(b.start_time)} – {clock(b.end_time)}</span>
                  <span className={`ud-state ${state.cls}`}>{state.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUserDetail;
