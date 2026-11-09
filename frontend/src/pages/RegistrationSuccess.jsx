import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import './RegistrationSuccess.css';

function RegistrationSuccess() {
  const { state } = useLocation();
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function resendVerification() {
    setResending(true);
    setResendMessage('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const result = await apiCall(
        '/auth/resend-verification',
        'POST',
        { email: state.email },
        { signal: controller.signal }
      );
      setResendMessage(result.message);
    } catch (error) {
      setResendMessage(controller.signal.aborted
        ? 'The email service took too long to respond. Please try again later.'
        : error.message);
    } finally {
      window.clearTimeout(timeout);
      setResending(false);
    }
  }

  async function cancelRegistration() {
    if (!state?.cancel_token || !window.confirm('Cancel this pending registration? The verification link will stop working and no account will be created.')) return;
    setCanceling(true);
    setResendMessage('');
    try {
      const result = await apiCall('/auth/cancel-registration', 'POST', {
        email: state.email,
        cancel_token: state.cancel_token,
      });
      setCancelled(true);
      setResendMessage(result.message);
    } catch (error) {
      setResendMessage(error.message);
    } finally {
      setCanceling(false);
    }
  }

  if (!state?.email || !state?.role) {
    return (
      <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
        <div className="registration-success">
          <h1>No recent registration found</h1>
          <p className="registration-success-description">
            Start registration first, then you’ll see the email verification details here.
          </p>
          <div className="registration-success-actions">
            <Link className="registration-success-button" to="/register">Create an account</Link>
            <Link className="registration-success-secondary" to="/login">Back to sign in</Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
      <div className="registration-success">
        <div className={`registration-success-icon${cancelled ? ' is-cancelled' : ''}`} aria-hidden="true">{cancelled ? '×' : '✓'}</div>
        <h1>{cancelled ? 'Registration cancelled' : 'Verify your email'}</h1>
        <p className="registration-success-description">
          {cancelled
            ? 'Your pending registration was removed. No account was created.'
            : 'Your registration is pending. We’ll create your CST Sports Facility Booking account after you verify this email.'}
        </p>

        <div className="registration-success-email">
          <span>Email to verify</span>
          <strong>{state.email}</strong>
        </div>
        <p className="registration-success-role">
          Account type: <strong>{state.role}</strong>
        </p>

        {!cancelled && (
          <p className="registration-success-note">
            {state.verification_email_sent
              ? 'A verification link was sent to your email. It expires in 24 hours. Your account does not exist until you use the link.'
              : 'The verification email could not be sent. No account has been created yet. You can request a new link below.'}
          </p>
        )}

        {resendMessage && <p className="registration-success-note" role="status">{resendMessage}</p>}
        {!cancelled && (
          <div className="registration-success-pending-actions">
            <button className="registration-success-button" onClick={resendVerification} disabled={resending || canceling} type="button">
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            {state.cancel_token && (
              <button className="registration-success-cancel" onClick={cancelRegistration} disabled={resending || canceling} type="button">
                {canceling ? 'Cancelling…' : 'Cancel registration'}
              </button>
            )}
          </div>
        )}
        <div className="registration-success-actions">
          {cancelled
            ? <Link className="registration-success-secondary" to="/register">Register again</Link>
            : <Link className="registration-success-secondary" to="/login" state={{ registered: true, email: state.email }}>Continue to Sign In</Link>}
          <Link className="registration-success-secondary" to="/">Return to home</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default RegistrationSuccess;
