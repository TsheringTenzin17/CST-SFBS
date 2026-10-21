import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import './ProfileSettings.css';

const DEFAULT_PREFERENCES = {
  booking_updates: true,
  game_reminders: true,
  maintenance_alerts: true,
};

function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    let active = true;
    apiCall('/auth/profile')
      .then((result) => {
        if (!active) return;
        setProfile(result.profile);
        setPreferences(result.preferences);
      })
      .catch((error) => {
        if (active) setMessage({ type: 'error', text: error.message });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const initials = (profile?.full_name || user?.full_name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const joined = profile?.joined
    ? new Date(`${profile.joined}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '—';

  async function saveProfile(event) {
    event.preventDefault();
    setMessage(null);
    setSavingProfile(true);
    let savedProfile = false;
    try {
      // Save independent endpoints in sequence so a partial failure can be reported honestly.
      const profileResult = await apiCall('/auth/profile', 'PATCH', {
        full_name: profile.full_name,
        contact_number: profile.contact_number || '',
      });
      savedProfile = true;
      setProfile((current) => ({ ...current, ...profileResult.profile }));
      updateUser(profileResult.profile);

      const preferenceResult = await apiCall('/auth/preferences', 'PATCH', preferences);
      setPreferences(preferenceResult.preferences);
      setMessage({ type: 'success', text: 'Your profile and notification preferences have been saved.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: savedProfile
          ? `Profile details were saved, but notification preferences were not: ${error.message}`
          : error.message,
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'The new password and confirmation do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      const result = await apiCall('/auth/password', 'PATCH', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: result.message });
    } catch (error) {
      setPasswordMessage({ type: 'error', text: error.message });
    } finally {
      setSavingPassword(false);
    }
  }

  function setPreference(name, checked) {
    setPreferences((current) => ({ ...current, [name]: checked }));
  }

  if (loading) {
    return <main className="main profile-settings-page" role="status">Loading profile settings…</main>;
  }

  return (
    <main className="main profile-settings-page">
      <h1 className="title">{location.pathname === '/settings' ? 'Profile & Settings' : 'My Profile'}</h1>
      <p className="subtitle">Manage your account details, security, and notification preferences.</p>

      {message && <p className={`profile-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {!profile && (
        <p className="profile-message error">
          Profile could not be loaded. <Link to="/settings">Reload settings</Link>
        </p>
      )}

      {profile && (
        <div className="profile-settings-grid">
          <aside className="profile-card">
            <div className="profile-avatar" aria-hidden="true">{initials}</div>
            <h2>{profile.full_name}</h2>
            <span className="profile-role">{profile.role}</span>
            <dl className="profile-details">
              <div><dt>Student / Staff ID</dt><dd>{profile.student_staff_id || 'Not provided'}</dd></div>
              <div><dt>College email</dt><dd>{profile.email}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.contact_number || 'Not provided'}</dd></div>
              <div><dt>Member since</dt><dd>{joined}</dd></div>
            </dl>
          </aside>

          <div className="profile-settings-column">
            <form className="profile-form-card" onSubmit={saveProfile}>
              <h2>Personal Details</h2>
              <div className="profile-fields">
                <label>
                  Full name
                  <input
                    value={profile.full_name}
                    maxLength={120}
                    onChange={(event) => setProfile({ ...profile, full_name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Email address
                  <input value={profile.email} readOnly />
                </label>
                <label>
                  Student / Staff ID
                  <input value={profile.student_staff_id || ''} readOnly placeholder="Not provided" />
                </label>
                <label>
                  Phone number
                  <input
                    type="tel"
                    value={profile.contact_number || ''}
                    maxLength={30}
                    onChange={(event) => setProfile({ ...profile, contact_number: event.target.value })}
                    placeholder="Add a contact number"
                  />
                </label>
              </div>

              <div className="profile-section-divider" />
              <h2>Notification Preferences</h2>
              <div className="profile-preferences">
                <label className="profile-preference">
                  <span><strong>Booking status updates</strong><small>Updates when a booking is confirmed, cancelled, or changed.</small></span>
                  <input type="checkbox" checked={preferences.booking_updates} onChange={(event) => setPreference('booking_updates', event.target.checked)} />
                </label>
                <label className="profile-preference">
                  <span><strong>Game reminders</strong><small>Reminders before your scheduled booking.</small></span>
                  <input type="checkbox" checked={preferences.game_reminders} onChange={(event) => setPreference('game_reminders', event.target.checked)} />
                </label>
                <label className="profile-preference">
                  <span><strong>Maintenance alerts</strong><small>Notices about maintenance affecting facilities.</small></span>
                  <input type="checkbox" checked={preferences.maintenance_alerts} onChange={(event) => setPreference('maintenance_alerts', event.target.checked)} />
                </label>
              </div>

              <div className="profile-form-actions">
                <button className="btn-primary" type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>

            <form className="profile-form-card" onSubmit={changePassword}>
              <h2>Update Security Credentials</h2>
              {passwordMessage && (
                <p className={`profile-message ${passwordMessage.type}`} role={passwordMessage.type === 'error' ? 'alert' : 'status'}>
                  {passwordMessage.text}
                </p>
              )}
              <div className="profile-fields password-fields">
                <label className="profile-field-wide">
                  Current password
                  <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
                </label>
                <label>
                  New password
                  <input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
                </label>
                <label>
                  Confirm new password
                  <input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                </label>
              </div>
              <div className="profile-form-actions">
                <button className="btn-primary" type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default ProfileSettings;
