import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import './ProfileSettings.css';

const DEFAULT_PREFERENCES = {
  booking_updates: true,
  game_reminders: true,
  maintenance_alerts: true,
};

const PREFERENCE_OPTIONS = [
  ['booking_updates', 'Booking status updates', 'Updates when a booking is confirmed, cancelled, or changed.'],
  ['game_reminders', 'Game reminders', 'Reminders 24 hours and 2 hours before your scheduled booking.'],
  ['maintenance_alerts', 'Maintenance alerts', 'Notices about maintenance affecting facilities you have booked.'],
];

const ROLE_LABELS = { student: 'Student', faculty: 'Faculty / Staff', outsider: 'Outsider', admin: 'Admin' };
const GENDER_LABELS = { female: 'Female', male: 'Male' };

function ProfileSettings() {
  const { user, updateUser } = useAuth();
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

  // Email change (outsiders only)
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState(null);

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
  const isOutsider = profile?.role === 'outsider';
  const genderLocked = Boolean(user?.gender);

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
        gender: profile.gender || null,
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

  async function requestEmailChange(event) {
    event.preventDefault();
    setEmailMessage(null);
    setSendingEmail(true);
    try {
      const result = await apiCall('/auth/email-change', 'POST', {
        new_email: newEmail,
        current_password: emailPassword,
      });
      setProfile((current) => ({ ...current, pending_email: result.pending_email }));
      setEmailMessage({ type: 'success', text: result.message });
      setShowEmailForm(false);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      setEmailMessage({ type: 'error', text: error.message });
    } finally {
      setSendingEmail(false);
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
      <h1 className="title">Profile &amp; Settings</h1>
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
            <span className="profile-role">{ROLE_LABELS[profile.role] || profile.role}</span>
            <dl className="profile-details">
              {!isOutsider && <div><dt>Student / Staff ID</dt><dd>{profile.student_staff_id || 'Not provided'}</dd></div>}
              {isOutsider && <div><dt>Organization</dt><dd>{profile.organization || 'Not provided'}</dd></div>}
              <div><dt>{isOutsider ? 'Email' : 'Campus email'}</dt><dd>{profile.email}</dd></div>
              <div><dt>Phone number</dt><dd>{profile.contact_number || 'Not provided'}</dd></div>
              <div><dt>Gender</dt><dd>{GENDER_LABELS[profile.gender] || 'Not set'}</dd></div>
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
                  Phone number
                  <input
                    type="tel"
                    inputMode="tel"
                    value={profile.contact_number || ''}
                    maxLength={20}
                    pattern="\+?[\d\s()\-]{7,20}"
                    title="Digits, spaces, + - ( ) only, 7 to 20 characters"
                    onChange={(event) => setProfile({ ...profile, contact_number: event.target.value })}
                    placeholder="e.g. 77682600"
                  />
                </label>
                <label>
                  Gender
                  <select
                    value={profile.gender || ''}
                    onChange={(event) => setProfile({ ...profile, gender: event.target.value })}
                    disabled={genderLocked}
                  >
                    <option value="">Select…</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                  <small>
                    {genderLocked
                      ? 'Set once and cannot be changed here. Contact the DSA office if it is wrong.'
                      : 'Used for gender-specific slots, like the female-student football slot.'}
                  </small>
                </label>
                {!isOutsider && (
                  <label className="profile-field-wide">
                    Student / Staff ID
                    <input value={profile.student_staff_id || ''} readOnly placeholder="Not provided" />
                    <small>Assigned by the college and cannot be edited.</small>
                  </label>
                )}
              </div>

              <div className="profile-section-divider" />
              <h2>Notification Preferences</h2>
              <div className="profile-preferences">
                {PREFERENCE_OPTIONS.map(([name, title, description]) => (
                  <label className="profile-preference" key={name}>
                    <span className="profile-preference-text"><strong>{title}</strong><small>{description}</small></span>
                    <span className="switch">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={preferences[name]}
                        onChange={(event) => setPreference(name, event.target.checked)}
                      />
                      <span className="switch-track" aria-hidden="true" />
                    </span>
                  </label>
                ))}
              </div>

              <div className="profile-form-actions">
                <button className="btn-primary" type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>

            <section className="profile-form-card" aria-labelledby="email-heading">
              <h2 id="email-heading">Email Address</h2>
              {emailMessage && (
                <p className={`profile-message ${emailMessage.type}`} role={emailMessage.type === 'error' ? 'alert' : 'status'}>
                  {emailMessage.text}
                </p>
              )}
              <div className="profile-email-row">
                <div>
                  <span className="profile-email-label">{isOutsider ? 'Current email' : 'Campus email'}</span>
                  <strong className="profile-email-value">{profile.email}</strong>
                </div>
                {isOutsider && !showEmailForm && (
                  <button type="button" className="btn-secondary" onClick={() => { setShowEmailForm(true); setEmailMessage(null); }}>
                    Change email
                  </button>
                )}
              </div>

              {profile.pending_email && (
                <p className="profile-message info" role="status">
                  Waiting for confirmation: open the link we sent to <strong>{profile.pending_email}</strong> to finish the change.
                  Until then you keep signing in with {profile.email}.
                </p>
              )}

              {!isOutsider && (
                <p className="profile-hint">
                  Your campus email decides your account type and ID, so it cannot be changed here.
                  If it is wrong, <Link to="/help">contact the DSA office</Link>.
                </p>
              )}

              {isOutsider && showEmailForm && (
                <form className="profile-email-form" onSubmit={requestEmailChange}>
                  <div className="profile-fields">
                    <label>
                      New Gmail address
                      <input
                        type="email"
                        autoComplete="email"
                        value={newEmail}
                        maxLength={150}
                        pattern="[^@\s]+@[Gg][Mm][Aa][Ii][Ll]\.[Cc][Oo][Mm]"
                        title="Use a Gmail address ending in @gmail.com"
                        onChange={(event) => setNewEmail(event.target.value)}
                        placeholder="name@gmail.com"
                        required
                      />
                    </label>
                    <label>
                      Current password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={emailPassword}
                        onChange={(event) => setEmailPassword(event.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <p className="profile-hint">We will email a confirmation link to the new address. Your email only changes once you open it.</p>
                  <div className="profile-form-actions">
                    <button type="button" className="btn-secondary" onClick={() => { setShowEmailForm(false); setNewEmail(''); setEmailPassword(''); }}>
                      Cancel
                    </button>
                    <button className="btn-primary" type="submit" disabled={sendingEmail}>
                      {sendingEmail ? 'Sending…' : 'Send confirmation link'}
                    </button>
                  </div>
                </form>
              )}
            </section>

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
                  <input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" required />
                </label>
                <label>
                  Confirm new password
                  <input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-type new password" required />
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
