import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { apiCall } from '../utils/api';

function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiCall('/auth/reset-password', 'POST', { token, new_password: password });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
      <h1>Choose a new password</h1>
      {message && <p className="auth-note" role="status">{message} <Link to="/login">Sign in</Link></p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!message && (
        <form onSubmit={submit} className="auth-form">
          <label className="auth-field">
            <span className="auth-label">New password</span>
            <input type="password" autoComplete="new-password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="auth-field">
            <span className="auth-label">Confirm new password</span>
            <input type="password" autoComplete="new-password" minLength="8" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
          </label>
          <button className="auth-submit" disabled={loading || !token} type="submit">
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
      {!token && <p className="auth-error" role="alert">This reset link is missing its token.</p>}
      <p className="auth-switch"><Link className="auth-link" to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}

export default ResetPassword;
