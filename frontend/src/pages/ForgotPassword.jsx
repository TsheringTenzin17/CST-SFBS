import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { apiCall } from '../utils/api';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setResetUrl('');
    setError('');
    try {
      const result = await apiCall('/auth/forgot-password', 'POST', { email });
      setMessage(result.message);
      setResetUrl(result.reset_url || '');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
      <h1>Reset your password</h1>
      <p className="auth-sub">Enter your account email and we’ll send a one-hour reset link if a verified account exists.</p>
      {message && <p className="auth-note" role="status">{message}</p>}
      {resetUrl && (
        <p className="auth-note">
          <a className="auth-link" href={resetUrl}>Open password reset page</a>
        </p>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form onSubmit={submit} className="auth-form">
        <label className="auth-field">
          <span className="auth-label">Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="auth-switch"><Link className="auth-link" to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}

export default ForgotPassword;
