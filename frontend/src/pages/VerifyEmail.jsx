import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout, { SPORTS } from '../components/AuthLayout';
import { Spinner } from '../components/Loading';
import { apiCall } from '../utils/api';
import './VerifyEmail.css';

function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('We’re checking your verification link.');

  useEffect(() => {
    let active = true;
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token. Request a new link to continue.');
      return () => {
        active = false;
      };
    }

    setStatus('loading');
    setMessage('We’re checking your verification link.');
    apiCall('/auth/verify-email', 'POST', { token })
      .then((result) => {
        if (active) {
          setStatus('success');
          setMessage(result.message);
        }
      })
      .catch((requestError) => {
        if (active) {
          setStatus('error');
          setMessage(
            requestError.message ||
              'We could not verify this email. Request a new link and try again.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  return (
    <AuthLayout
      headline={['Book your court.', 'Play your game.']}
      tagline="Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts."
      chips={SPORTS}
    >
      <div className={`verify-email ${status}`} aria-live="polite">
        <div className="verify-email-icon" aria-hidden="true">
          {isLoading ? <span className="verify-email-spinner" /> : isSuccess ? '✓' : '!'}
        </div>
        <span className="verify-email-eyebrow">
          {isLoading
            ? 'Email verification'
            : isSuccess
              ? 'Verification complete'
              : 'Verification needed'}
        </span>
        <h1>
          {isLoading
            ? 'Verifying your email'
            : isSuccess
              ? 'You’re all set'
              : 'We couldn’t verify your email'}
        </h1>
        <p className="verify-email-message" role={isLoading ? 'status' : 'alert'}>
          {isLoading ? <Spinner label={message} /> : message}
        </p>
        {!isLoading && (
          <div className="verify-email-actions">
            {isSuccess ? (
              <Link className="verify-email-primary" to="/login">
                Continue to sign in
              </Link>
            ) : (
              <>
                <Link className="verify-email-primary" to="/register">
                  Return to registration
                </Link>
                <p className="verify-email-help">
                  If the link has expired, register again to request a new verification email.
                </p>
              </>
            )}
            <Link className="verify-email-secondary" to="/">
              Return to home
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
