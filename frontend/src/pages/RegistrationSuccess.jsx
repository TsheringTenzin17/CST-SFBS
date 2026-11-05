import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/api';
import AuthLayout from '../components/AuthLayout';
import './RegistrationSuccess.css';

function RegistrationSuccess() {
  const { state } = useLocation();
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);

  async function resendVerification() {
    setResending(true);
    setResendMessage('');
    try {
      const result = await apiCall('/auth/resend-verification', 'POST', { email: state.email });
      setResendMessage(result.message);
    } catch (error) {
      setResendMessage(error.message);
    } finally {
      setResending(false);
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
        <div className="registration-success-icon" aria-hidden="true">✓</div>
        <h1>Verify your email</h1>
        <p className="registration-success-description">
          Your registration is pending. We’ll create your CST Sports Facility Booking account after you verify this email.
        </p>

        <div className="registration-success-email">
          <span>Email to verify</span>
          <strong>{state.email}</strong>
        </div>
        <p className="registration-success-role">
          Account type: <strong>{state.role}</strong>
        </p>

        <p className="registration-success-note">
          {state.verification_email_sent
            ? 'A verification link was sent to your email. It expires in 24 hours. Your account does not exist until you use the link.'
            : 'The verification email could not be sent. No account has been created yet. You can request a new link below.'}
        </p>

        {resendMessage && <p className="registration-success-note" role="status">{resendMessage}</p>}
        <button className="registration-success-button" onClick={resendVerification} disabled={resending} type="button">
          {resending ? 'Sending…' : 'Resend verification email'}
        </button>
        <div className="registration-success-actions">
          <Link className="registration-success-secondary" to="/login" state={{ registered: true, email: state.email }}>
            Continue to Sign In
          </Link>
          <Link className="registration-success-secondary" to="/">Return to home</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default RegistrationSuccess;
