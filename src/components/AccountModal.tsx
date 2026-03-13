import { useState } from 'react';
import { AuthUser, updateProfile, changePassword } from '../utils/authService';
import './AccountModal.css';

interface AccountModalProps {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
}

type Tab = 'profile' | 'password';

export default function AccountModal({ user, onClose, onUserUpdated }: AccountModalProps) {
  const [tab, setTab] = useState<Tab>('profile');

  // Profile tab
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password tab
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const updates: { name?: string; email?: string } = {};
    if (name.trim() !== user.name) updates.name = name.trim();
    if (email.trim().toLowerCase() !== user.email) updates.email = email.trim();

    if (Object.keys(updates).length === 0) {
      setProfileError('No changes to save.');
      return;
    }

    setProfileLoading(true);
    const result = await updateProfile(updates);
    setProfileLoading(false);

    if (!result.success) {
      setProfileError(result.error || 'Update failed');
      return;
    }

    setProfileSuccess('Profile updated.');
    onUserUpdated(result.user!);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    setPasswordLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setPasswordLoading(false);

    if (!result.success) {
      setPasswordError(result.error || 'Failed to change password');
      return;
    }

    setPasswordSuccess('Password changed successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="acct-overlay" onClick={onClose}>
      <div className="acct-modal" onClick={e => e.stopPropagation()}>
        <div className="acct-header">
          <h3 className="acct-title">My Account</h3>
          <button className="acct-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="acct-tabs">
          <button
            className={`acct-tab ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => setTab('profile')}
          >
            Profile
          </button>
          <button
            className={`acct-tab ${tab === 'password' ? 'active' : ''}`}
            onClick={() => setTab('password')}
          >
            Password
          </button>
        </div>

        {tab === 'profile' && (
          <form className="acct-form" onSubmit={handleProfileSubmit}>
            <div className="acct-field">
              <label htmlFor="acct-name">Name</label>
              <input
                id="acct-name"
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setProfileSuccess(''); }}
                required
                disabled={profileLoading}
              />
            </div>
            <div className="acct-field">
              <label htmlFor="acct-email">Email</label>
              <input
                id="acct-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setProfileSuccess(''); }}
                required
                disabled={profileLoading}
              />
            </div>

            {profileError && <div className="acct-error">{profileError}</div>}
            {profileSuccess && <div className="acct-success">{profileSuccess}</div>}

            <div className="acct-actions">
              <button type="button" className="acct-btn" onClick={onClose} disabled={profileLoading}>
                Cancel
              </button>
              <button type="submit" className="acct-btn acct-btn-primary" disabled={profileLoading}>
                {profileLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {tab === 'password' && (
          <form className="acct-form" onSubmit={handlePasswordSubmit}>
            <div className="acct-field">
              <label htmlFor="acct-cur-pw">Current Password</label>
              <div className="acct-pw-wrap">
                <input
                  id="acct-cur-pw"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPasswordSuccess(''); }}
                  required
                  disabled={passwordLoading}
                  autoComplete="current-password"
                />
                <button type="button" className="acct-peek" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}>
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="acct-field">
              <label htmlFor="acct-new-pw">New Password</label>
              <div className="acct-pw-wrap">
                <input
                  id="acct-new-pw"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordSuccess(''); }}
                  required
                  disabled={passwordLoading}
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                />
                <button type="button" className="acct-peek" onClick={() => setShowNew(v => !v)} tabIndex={-1}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div className="acct-field">
              <label htmlFor="acct-confirm-pw">Confirm New Password</label>
              <input
                id="acct-confirm-pw"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordSuccess(''); }}
                required
                disabled={passwordLoading}
                autoComplete="new-password"
              />
            </div>

            {passwordError && <div className="acct-error">{passwordError}</div>}
            {passwordSuccess && <div className="acct-success">{passwordSuccess}</div>}

            <div className="acct-actions">
              <button type="button" className="acct-btn" onClick={onClose} disabled={passwordLoading}>
                Cancel
              </button>
              <button type="submit" className="acct-btn acct-btn-primary" disabled={passwordLoading}>
                {passwordLoading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
