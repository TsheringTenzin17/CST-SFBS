import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { SPORTS } from '../components/AuthLayout';
import { Spinner } from '../components/Loading';
import { checkPassword } from '../utils/passwordStrength';  // password strength checker

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const COLLEGE_EMAIL = /^[^@\s]+\.cst@rub\.edu\.bt$/i;
const BHUTAN_MOBILE = /^(?:16|17|77)\d{6}$/;

// The three ways to sign up. "role" is the value the backend stores.
const TABS = [
  { id: 'student', label: 'Student', role: 'student' },
  { id: 'staff', label: 'Staff', role: 'faculty' },
  { id: 'outsider', label: 'Outsider / Commercial', role: 'outsider' },
];

// 02210145.cst@rub.edu.bt -> "02210145"   |   kwangdi.cst@rub.edu.bt -> "kwangdi"
function localPart(email) {
  return email.trim().toLowerCase().split('.cst@')[0];
}
const isStudentEmail = (email) =>
  COLLEGE_EMAIL.test(email.trim()) && /^\d+$/.test(localPart(email));
const isStaffEmail = (email) => COLLEGE_EMAIL.test(email.trim()) && !/^\d+$/.test(localPart(email));

function Field({ label, hint, hintClass, error, errorId, fieldRef, children }) {
  return (
    <label ref={fieldRef} className={`auth-field${error ? ' has-error' : ''}`}>
      <span className="auth-label">{label}</span>
      {children}
      {error && (
        <span id={errorId} className="auth-field-error">
          {error}
        </span>
      )}
      {hint && <span className={hintClass ? `auth-hint ${hintClass}` : 'auth-hint'}>{hint}</span>}
    </label>
  );
}

function EyeIcon({ off }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M17.9 17.9A10.9 10.9 0 0112 19C5.5 19 1.5 12 1.5 12a19.3 19.3 0 014.6-5.4M9.9 5.2A10 10 0 0112 5c6.5 0 10.5 7 10.5 7a19.5 19.5 0 01-2.2 3.2M1 1l22 22" />
          <path d="M9.9 9.9a3 3 0 004.2 4.2" />
        </>
      ) : (
        <>
          <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

const EMPTY = {
  full_name: '',
  email: '',
  phone: '',
  gender: '',
  organization: '',
  purpose: '',
  password: '',
  confirm: '',
};

function Register() {
  const [tab, setTab] = useState('student'); // 'student' | 'staff' | 'outsider'
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const formErrorRef = useRef(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const navigate = useNavigate();

    // ---------- password strength (for the hint under the box) ----------
  const strength = checkPassword(form.password);                  // weak, medium or strong
  const passwordHint = !form.password                             // nothing typed yet
    ? 'Min 8 characters. Use capital, small, number and symbol.'  // show the rule
    : strength.ok                                                 // medium or strong
      ? `Password strength: ${strength.level}.`                   // show the level
      : `Too weak. Add: ${strength.tips.join(', ')}.`;            // show what is missing

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const role = TABS[tabIndex].role;
  const isStudent = tab === 'student';
  const isStaff = tab === 'staff';
  const isOutsider = tab === 'outsider';

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError(null);
  };
  const setPhone = (event) => {
    set('phone')({ target: { value: event.target.value.replace(/\D/g, '').slice(0, 8) } });
  };

  function showFieldErrors(nextErrors) {
    setFieldErrors(nextErrors);
    setError(null);
    setFocusRequest((current) => current + 1);
  }

  function showFormError(message) {
    setFieldErrors({});
    setError(message);
    setFocusRequest((current) => current + 1);
  }

  useEffect(() => {
    if (focusRequest === 0) return;
    const target = error
      ? formErrorRef.current
      : document.querySelector('.auth-field.has-error input, .auth-field.has-error select');
    if (!target) return;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    document.documentElement.scrollTo({
      top: Math.max(0, targetTop - window.innerHeight * 0.35),
      behavior: 'instant',
    });
    target.focus({ preventScroll: true });
  }, [focusRequest, error]);

  function fieldFromMessage(message) {
    const text = message.toLowerCase();
    if (/name/.test(text) && /full_name|full name|required|120 characters/.test(text))
      return 'full_name';
    if (/email|student email|staff email|college email|gmail|student.*staff id/.test(text))
      return 'email';
    if (/phone|mobile|contact number/.test(text)) return 'phone';
    if (/gender/.test(text)) return 'gender';
    if (/password/.test(text)) return text.includes('match') ? 'confirm' : 'password';
    if (/organization|team name/.test(text)) return 'organization';
    return null;
  }

  function inputErrorProps(field) {
    return fieldErrors[field] ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {};
  }

  function switchTab(next) {
    if (next === tab) return;
    setTab(next);
    setError(null);
    setFieldErrors({});
    setForm((f) => ({ ...f, email: '' })); // each option uses a different kind of email
  }

  // Is the typed email right for the selected tab?
  const email = form.email.trim();
  const emailOk = isStudent ? isStudentEmail(email) : isStaff ? isStaffEmail(email) : false;
  const studentId = isStudent && emailOk ? localPart(email) : '';

  let emailHint;
  let emailHintClass;
  if (isStudent) {
    if (emailOk) {
      emailHint = 'You will be registered as: Student';
      emailHintClass = 'ok';
    } else if (isStaffEmail(email)) {
      emailHint = 'This looks like a staff email. Pick the Staff option.';
      emailHintClass = 'bad';
    } else emailHint = 'Use your student email: 02xxxxxx.cst@rub.edu.bt';
  } else if (isStaff) {
    if (emailOk) {
      emailHint = 'You will be registered as: Staff. No ID needed, you sign in with this email.';
      emailHintClass = 'ok';
    } else if (isStudentEmail(email)) {
      emailHint = 'This looks like a student email. Pick the Student option.';
      emailHintClass = 'bad';
    } else emailHint = 'Use your staff email: yourname.cst@rub.edu.bt';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const nextErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = 'Enter your full name.';
    if (isStudent && !isStudentEmail(email)) {
      nextErrors.email = 'Use your student number email, like 02210145.cst@rub.edu.bt.';
    }
    if (isStaff && !isStaffEmail(email)) {
      nextErrors.email = 'Use your staff email, like yourname.cst@rub.edu.bt.';
    }
    if (isOutsider && !/^[^@\s]+@gmail\.com$/i.test(email)) {
      nextErrors.email = 'Use a valid Gmail address ending in @gmail.com.';
    }
    // Outsiders must give an organization name, or a team name if they are not with an organization.
    if (isOutsider && !form.organization.trim()) {
      nextErrors.organization = 'Enter your organization name or team name.';
    } else if (isOutsider && form.organization.trim().length > 120) {
      nextErrors.organization = 'Organization or team name must be 120 characters or fewer.';
    }
    if (!BHUTAN_MOBILE.test(form.phone)) {
      nextErrors.phone = 'Enter an 8-digit Bhutan mobile number starting with 16, 17 or 77.';
    }
    if (!form.gender) {
      nextErrors.gender = 'Select your gender.';
    }
    if (!strength.ok) {                                                                          // block weak passwords
      nextErrors.password = 'Password is too weak. Add a mix of letters, numbers and symbols.';  // error text
    }
    if (form.password !== form.confirm) {
      nextErrors.confirm = 'Passwords do not match.';
    }
    if (Object.keys(nextErrors).length > 0) {
      showFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    const base = {
      full_name: form.full_name.trim(),
      email: email.toLowerCase(),
      password: form.password,
      contact_number: form.phone.trim(),
      role,
      gender: form.gender,
    };
    let payload;
    if (isStudent) payload = { ...base, student_staff_id: studentId };
    else if (isStaff)
      payload = base; // staff have no ID
    else
      payload = { ...base, organization: form.organization.trim(), purpose: form.purpose.trim() };

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.pending_verification || data.account_created) {
        navigate('/registration-success', {
          replace: true,
          state: {
            email: data.email || data.user?.email || base.email,
            role: data.role || data.user?.role || role,
            verification_email_sent: data.verification_email_sent === true,
            cancel_token: data.cancel_token,
          },
        });
        return;
      }
      if (!res.ok) {
        const message = data.error || 'Registration failed';
        const field = fieldFromMessage(message);
        if (field) showFieldErrors({ [field]: message });
        else showFormError(message);
        return;
      }
      // Carry only confirmation details to the success screen; credentials stay out of route state.
      navigate('/registration-success', {
        replace: true,
        state: {
          email: data.user.email,
          role: data.user.role,
          verification_email_sent: data.verification_email_sent,
        },
      });
    } catch {
      showFormError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const subText = {
    student: <>Use your student email ending .cst@rub.edu.bt</>,
    staff: <>Use your staff email ending .cst@rub.edu.bt</>,
    outsider: <>Not part of CST? Create an outsider account.</>,
  }[tab];

  return (
    <AuthLayout
      headline={['Join the game.', 'Book your court.']}
      tagline="Create an account to reserve campus sports facilities in a few taps, without conflicts."
      chips={SPORTS}
    >
      <h1>Create your account</h1>
      <p className="auth-sub">{subText}</p>

      <div
        className="auth-tabs"
        role="tablist"
        style={{ '--tab-count': TABS.length, '--tab-index': tabIndex }}
      >
        <span className="auth-tab-pill" aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'auth-tab active' : 'auth-tab'}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div ref={formErrorRef} className="auth-error" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <Field label="Full name" error={fieldErrors.full_name} errorId="full_name-error">
          <input
            value={form.full_name}
            onChange={set('full_name')}
            placeholder="Tshering Dorji"
            autoComplete="name"
            {...inputErrorProps('full_name')}
          />
        </Field>

        {isStudent && (
          <>
            <Field
              label="Student email"
              hint={emailHint}
              hintClass={emailHintClass}
              error={fieldErrors.email}
              errorId="email-error"
            >
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="02210145.cst@rub.edu.bt"
                autoComplete="email"
                {...inputErrorProps('email')}
              />
            </Field>
            <div className="auth-row">
              <Field label="Student ID" hint="Taken from your email.">
                <input value={studentId} readOnly placeholder="02210145" />
              </Field>
              <Field label="Phone number" error={fieldErrors.phone} errorId="phone-error">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={setPhone}
                  placeholder="xxxxxxxx"
                  autoComplete="tel-national"
                  {...inputErrorProps('phone')}
                />
              </Field>
            </div>
          </>
        )}

        {isStaff && (
          <>
            <Field
              label="Staff email"
              hint={emailHint}
              hintClass={emailHintClass}
              error={fieldErrors.email}
              errorId="email-error"
            >
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="yourname.cst@rub.edu.bt"
                autoComplete="email"
                {...inputErrorProps('email')}
              />
            </Field>
            <Field label="Phone number" error={fieldErrors.phone} errorId="phone-error">
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={setPhone}
                placeholder="xxxxxxxx"
                autoComplete="tel-national"
                {...inputErrorProps('phone')}
              />
            </Field>
          </>
        )}

        {isOutsider && (
          <>
            <Field
              label="Email"
              hint="Use a Gmail address (@gmail.com)."
              error={fieldErrors.email}
              errorId="email-error"
            >
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="karma@gmail.com"
                autoComplete="email"
                {...inputErrorProps('email')}
              />
            </Field>
            <div className="auth-row">
              <Field label="Phone number" error={fieldErrors.phone} errorId="phone-error">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={setPhone}
                  placeholder="xxxxxxxx"
                  autoComplete="tel-national"
                  {...inputErrorProps('phone')}
                />
              </Field>
              <Field
                label="Organization or team name"
                error={fieldErrors.organization}
                errorId="organization-error"
              >
                <input
                  value={form.organization}
                  onChange={set('organization')}
                  placeholder="e.g. Druk United FC"
                  maxLength={120}
                  {...inputErrorProps('organization')}
                />
              </Field>
            </div>
            <p className="auth-hint">Not with an organization? Enter the name of your team.</p>
            <Field label="Purpose of booking">
              <input
                value={form.purpose}
                onChange={set('purpose')}
                placeholder="e.g. weekend football match"
              />
            </Field>
          </>
        )}

        <Field
          label="Gender"
          hint="Used for gender-specific slots, like the female-student football slot."
          error={fieldErrors.gender}
          errorId="gender-error"
        >
          <select value={form.gender} onChange={set('gender')} {...inputErrorProps('gender')}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>

        <div className="auth-row">
          {/* password box  -  shows live strength hint (green = ok, red = weak) */}
          <Field
            label="Password"
            hint={passwordHint}
            hintClass={form.password ? (strength.ok ? 'ok' : 'bad') : ''}
            error={fieldErrors.password}
            errorId="password-error"
          >
            <div className="auth-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="••••••••"
                autoComplete="new-password"
                {...inputErrorProps('password')}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </Field>
          <Field label="Confirm password" error={fieldErrors.confirm} errorId="confirm-error">
            <div className="auth-input-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirm}
                onChange={set('confirm')}
                placeholder="••••••••"
                autoComplete="new-password"
                {...inputErrorProps('confirm')}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={showConfirmPassword} />
              </button>
            </div>
          </Field>
        </div>

        <div className="auth-note">
          {isOutsider
            ? 'Verify your email before signing in. Commercial rates apply; payment is handled offline with the DSA office.'
            : 'You must verify your email before signing in.'}
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          <span className="auth-submit-label">
            {loading ? <Spinner label="Creating account…" /> : 'Create Account'}
          </span>
        </button>
      </form>

      <p className="auth-switch">
        Already registered?{' '}
        <Link to="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
