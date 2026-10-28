import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout, { SPORTS } from '../components/AuthLayout';
import { apiCall } from '../utils/api';

function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [message, setMessage] = useState('Verifying your email…');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setMessage('This verification link is missing its token.');
      setError(true);
      return () => { active = false; };
    }
    apiCall('/auth/verify-email', 'POST', { token })
      .then((result) => { if (active) setMessage(result.message); })
      .catch((requestError) => {
        if (active) {
          setMessage(requestError.message);
          setError(true);
        }
      });
    return () => { active = false; };
  }, [token]);

  return (
    <AuthLayout
      headline={['Book your court.', 'Play your game.']}
      tagline="Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts."
      chips={SPORTS}
    >
      <h1>{error ? 'Email verification failed' : 'Verify your email'}</h1>
      <p className={error ? 'auth-error' : 'auth-note'} role="status">{message}</p>
      {error
        ? <Link className="auth-link" to="/register">Return to registration</Link>
        : <Link className="auth-link" to="/login">Continue to sign in</Link>}
    </AuthLayout>
  );
}

export default VerifyEmail;
