import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import AccountsPanel from '../components/AccountsPanel';

export default function SettingsAccounts() {
  const { user, isAdmin, applyAuthResult } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const savePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError('');
    setMessage('');
    setBusy(true);
    try {
      applyAuthResult(await api.changePassword(currentPassword, newPassword));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">Change password</div>
        <div className="settings-section">
          {error && <div className="error-banner">{error}</div>}
          {message && <div className="success-banner">{message}</div>}
          {user?.isShared ? (
            <p className="settings-intro">
              Please contact the administrator to reset the password for this account.
            </p>
          ) : (
          <form onSubmit={savePassword} className="totp-form">
            <div className="form-field">
              <label htmlFor="current-password" className="required">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-password" className="required">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="confirm-password" className="required">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Update password'}
            </button>
          </form>
          )}
        </div>
      </div>
      {isAdmin && <AccountsPanel />}
    </div>
  );
}
