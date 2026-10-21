import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import AuthLayout from '../components/AuthLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const justRegistered = location.state?.registered;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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

  return (
    <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
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
            placeholder="username"
            required
          />
        </label>

        <div className="auth-field">
          <div className="auth-label-row">
            <span className="auth-label">Password</span>
            <a
              href="#"
              className="auth-link"
              onClick={(e) => {
                e.preventDefault();
                setInfo('Password reset is not available yet. Please contact the DSA office.');
              }}
            >
              Forgot password?
            </a>
          </div>
          <input
            type="password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Access Booking System'}
        </button>
      </form>

      <p className="auth-switch">
        New here? <Link to="/register" className="auth-link">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;