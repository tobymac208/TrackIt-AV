import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';

export default function SetupAccount() {
  const { user, applyAuthResult, logout } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setError('');
    setBusy(true);
    try {
      setSetup(await api.setupTotp());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enableTotp = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      applyAuthResult(await api.enableTotp(code));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError('');
    setBusy(true);
    try {
      applyAuthResult(await api.changePassword(currentPassword, newPassword));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1>Finish account setup</h1>
          <p>
            Signed in as <strong>{user.username}</strong>. Complete the required steps to use TrackIt! AV
          </p>
        </div>
        {error && <div className="error-banner">{error}</div>}

        {user.mustSetupTotp && (
          <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <h3>Authenticator app</h3>
            <p className="settings-intro">This account requires Google Authenticator before you can continue.</p>
            {setup ? (
              <form onSubmit={enableTotp} className="totp-form">
                <img className="totp-qr" src={setup.qrDataUrl} alt="Authenticator QR code" />
                <p className="settings-intro">
                  Or enter this key manually: <code>{setup.secret}</code>
                </p>
                <div className="form-field">
                  <label htmlFor="setup-totp" className="required">
                    Authenticator code
                  </label>
                  <input
                    id="setup-totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={8}
                    required
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Enabling...' : 'Enable authenticator'}
                </button>
              </form>
            ) : (
              <button className="btn btn-primary" type="button" onClick={startSetup} disabled={busy}>
                {busy ? 'Preparing...' : 'Set up Google Authenticator'}
              </button>
            )}
          </div>
        )}

        {!user.mustSetupTotp && user.mustChangePassword && (
          <form onSubmit={savePassword}>
            <h3>Choose a new password</h3>
            <p className="settings-intro">Use at least 8 characters.</p>
            <div className="form-field">
              <label htmlFor="setup-current" className="required">
                Current password
              </label>
              <input
                id="setup-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="setup-new" className="required">
                New password
              </label>
              <input
                id="setup-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="form-field">
              <label htmlFor="setup-confirm" className="required">
                Confirm new password
              </label>
              <input
                id="setup-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save password'}
            </button>
          </form>
        )}

        <button type="button" className="btn btn-secondary" onClick={logout} style={{ marginTop: '1rem' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
