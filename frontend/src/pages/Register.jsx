import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const COLLEGE_EMAIL = /^[^@\s]+\.cst@rub\.edu\.bt$/i;

// The backend independently applies this rule; the helper only gives registrants immediate feedback.
// Role comes from the college email, as in the design:
// 02210145.cst@rub.edu.bt -> student, kwangdi.cst@rub.edu.bt -> staff (faculty)
function roleFromEmail(email) {
  const local = email.trim().toLowerCase().split('.cst@')[0];
  return /^\d+$/.test(local) ? 'student' : 'faculty';
}

function Field({ label, hint, children }) {
  return (
    <label className="auth-field">
      <span className="auth-label">{label}</span>
      {children}
      {hint && <span className="auth-hint">{hint}</span>}
    </label>
  );
}

const EMPTY = {
  full_name: '', email: '', student_staff_id: '', phone: '',
  organization: '', purpose: '', password: '', confirm: '',
};

function Register() {
  const [tab, setTab] = useState('staff'); // 'staff' | 'outsider'
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isStaff = tab === 'staff';

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function switchTab(next) {
    setTab(next);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (isStaff && !COLLEGE_EMAIL.test(form.email.trim())) {
      setError('Use your college email ending .cst@rub.edu.bt');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    const base = {
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      contact_number: form.phone.trim(),
    };
    const payload = isStaff
      ? { ...base, student_staff_id: form.student_staff_id.trim(), role: roleFromEmail(form.email) }
      : { ...base, role: 'outsider', organization: form.organization.trim(), purpose: form.purpose.trim() };

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }
      // Carry only confirmation details to the success screen; credentials stay out of route state.
      navigate('/registration-success', {
        replace: true,
        state: { email: data.user.email, role: data.user.role },
      });
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const emailOk = isStaff && COLLEGE_EMAIL.test(form.email.trim());
  const staffEmailHint = emailOk
    ? `You will be registered as: ${roleFromEmail(form.email) === 'student' ? 'Student' : 'Staff'}`
    : 'Your role (student or staff) is set from this email.';

  return (
    <AuthLayout
      tagline={
        isStaff
          ? 'Nurturing sporting excellence, teamwork and healthy campus life.'
          : 'Outside groups and commercial users are welcome to book under the college facility rules.'
      }
    >
      <h1>Create your account</h1>
      <p className="auth-sub">
        {isStaff ? 'Use your college email ending .cst@rub.edu.bt' : 'Not part of CST? Create an outsider account.'}
      </p>

      <div className="auth-tabs">
        <button type="button" className={isStaff ? 'auth-tab active' : 'auth-tab'} onClick={() => switchTab('staff')}>
          CST Student / Staff
        </button>
        <button type="button" className={!isStaff ? 'auth-tab active' : 'auth-tab'} onClick={() => switchTab('outsider')}>
          Outsider / Commercial
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <Field label="Full name">
          <input value={form.full_name} onChange={set('full_name')} placeholder="Tshering Dorji" required />
        </Field>

        {isStaff ? (
          <>
            <Field label="College email" hint={staffEmailHint}>
              <input type="email" value={form.email} onChange={set('email')} placeholder="02210145.cst@rub.edu.bt" required />
            </Field>
            <div className="auth-row">
              <Field label="Student / Staff ID">
                <input value={form.student_staff_id} onChange={set('student_staff_id')} placeholder="02210145" required />
              </Field>
              <Field label="Phone number" hint="Only admins can see this, in case a booking needs follow-up.">
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+975 17 000 000" required />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Email" hint="Any email you own.">
              <input type="email" value={form.email} onChange={set('email')} placeholder="karma@gmail.com" required />
            </Field>
            <div className="auth-row">
              <Field label="Phone number">
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+975 17 000 000" required />
              </Field>
              <Field label="Organization (optional)">
                <input value={form.organization} onChange={set('organization')} placeholder="Team or company name" />
              </Field>
            </div>
            <Field label="Purpose of booking">
              <input value={form.purpose} onChange={set('purpose')} placeholder="e.g. weekend football match" />
            </Field>
          </>
        )}

        <div className="auth-row">
          <Field label="Password" hint="At least 8 characters.">
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </Field>
          <Field label="Confirm password">
            <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" required />
          </Field>
        </div>

        <div className="auth-note">
          {isStaff
            ? 'Your account is active as soon as you register.'
            : 'Your account is active as soon as you register. Commercial rates apply; payment is handled offline with the DSA office.'}
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="auth-switch">
        Already registered? <Link to="/login" className="auth-link">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export default Register;