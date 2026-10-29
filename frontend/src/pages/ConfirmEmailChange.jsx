import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout, { SPORTS } from '../components/AuthLayout';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';

// Opened from the link emailed to the NEW address after an email change request.
function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user, updateUser } = useAuth();
  const [message, setMessage] = useState('Confirming your new email address…');
  const [error, setError] = useState(false);
  // The link can be used once, so guard against React StrictMode running this effect twice in development.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setMessage('This confirmation link is missing its token.');
      setError(true);
      return;
    }
    apiCall('/auth/confirm-email-change', 'POST', { token })
      .then((result) => {
        setMessage(result.message);
        if (user && result.email) updateUser({ email: result.email });
      })
      .catch((requestError) => {
        setMessage(requestError.message);
        setError(true);
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthLayout
      headline={['Book your court.', 'Play your game.']}
      tagline="Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts."
      chips={SPORTS}
    >
      <h1>{error ? 'Email change failed' : 'Email address updated'}</h1>
      <p className={error ? 'auth-error' : 'auth-note'} role="status">{message}</p>
      {user
        ? <Link className="auth-link" to="/settings">Back to settings</Link>
        : <Link className="auth-link" to="/login">Continue to sign in</Link>}
    </AuthLayout>
  );
}

export default ConfirmEmailChange;
