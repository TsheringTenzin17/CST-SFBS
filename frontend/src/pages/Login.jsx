import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AuthLayout, { SPORTS } from '../components/AuthLayout';
import { apiCall } from '../utils/api';

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resending, setResending] = useState(false);
  const justRegistered = location.state?.registered;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setVerificationPending(false);
    const id = identifier.trim();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: id.includes('@') ? id.toLowerCase() : id, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setVerificationPending(data.code === 'EMAIL_NOT_VERIFIED');
        return;
      }
      if (!data.token) {
        setError('The server did not return a valid session. Please try again.');
        return;
      }
      login(data.user, data.token);
      navigate(data.user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    setInfo('');
    try {
      const result = await apiCall('/auth/resend-verification', 'POST', { email: identifier.trim() });
      setInfo(result.message);
    } catch (requestError) {
      setInfo(requestError.message);
    } finally {
      setResending(false);
    }
  }

  return (
      <AuthLayout
        headline={['Book your court.', 'Play your game.']}
        tagline="Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts."
        chips={SPORTS}
      >
      <h1>Sign in</h1>
      <p className="auth-sub">Students, staff and outsiders use the same sign-in.</p>

      {justRegistered && <div className="auth-success">Account created. Please sign in.</div>}
      {error && <div className="auth-error">{error}</div>}
      {info && <div className="auth-note">{info}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span className="auth-label">Email or Student / Staff ID</span>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="02xxxxxx.cst@rub.edu.bt"
            autoComplete="username"
            required
          />
        </label>

        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">Password</span>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <div className="auth-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              aria-label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          <span className="auth-submit-label">
            {loading ? 'Signing in…' : (
              <>
                Access Booking System
                <svg className="auth-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </span>
        </button>
      </form>

      {verificationPending && identifier.includes('@') && (
        <button className="auth-link" disabled={resending} onClick={resendVerification} type="button">
          {resending ? 'Sending…' : 'Resend verification email'}
        </button>
      )}
      <p className="auth-switch">
        New here? <Link to="/register" className="auth-link">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;