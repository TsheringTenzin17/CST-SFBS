import { Link, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import './RegistrationSuccess.css';

function RegistrationSuccess() {
  const { state } = useLocation();

  if (!state?.email || !state?.role) {
    return (
      <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
        <div className="registration-success">
          <h1>No recent registration found</h1>
          <p className="registration-success-description">
            Create an account first, then you’ll see its registration confirmation here.
          </p>
          <Link className="registration-success-button" to="/register">Create an account</Link>
          <Link className="registration-success-secondary" to="/login">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout tagline="Nurturing sporting excellence, teamwork and healthy campus life.">
      <div className="registration-success">
        <div className="registration-success-icon" aria-hidden="true">✓</div>
        <h1>Registration Successful!</h1>
        <p className="registration-success-description">
          Your CST Sports Facility Booking account has been created and is ready to use.
        </p>

        <div className="registration-success-email">
          <span>Registered email</span>
          <strong>{state.email}</strong>
        </div>
        <p className="registration-success-role">
          Account type: <strong>{state.role}</strong>
        </p>

        <p className="registration-success-note">
          Email verification is not enabled yet. You can sign in now using the email or Student / Staff ID and password you registered with.
        </p>

        <Link className="registration-success-button" to="/login" state={{ registered: true, email: state.email }}>
          Continue to Sign In
        </Link>
        <Link className="registration-success-secondary" to="/">Return to home</Link>
      </div>
    </AuthLayout>
  );
}

export default RegistrationSuccess;
