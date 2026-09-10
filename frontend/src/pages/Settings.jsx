import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import { THEMES, useTheme } from '../theme';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { isAdmin } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api
      .getTotpStatus()
      .then((status) => setTotpEnabled(Boolean(status.enabled)))
      .catch((err) => setError(err.message));
  }, [isAdmin]);

  const startSetup = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      setSetup(await api.setupTotp());
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enableTotp = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.enableTotp(code);
      setTotpEnabled(true);
      setSetup(null);
      setCode('');
      setMessage('Authenticator sign-in is on. The next admin login will ask for a code.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const disableTotp = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.disableTotp(code);
      setTotpEnabled(false);
      setSetup(null);
      setCode('');
      setMessage('Authenticator sign-in is off.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Preferences for this browser</p>
        </div>
      </div>

      {isAdmin && (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">Admin authenticator</div>
          <div className="settings-section">
            <p className="settings-intro">
              After you turn this on, signing in as <strong>admin</strong> requires your password and a
              6-digit code from Google Authenticator.
            </p>
            {error && <div className="error-banner">{error}</div>}
            {message && <div className="success-banner">{message}</div>}

            {totpEnabled && !setup ? (
              <form onSubmit={disableTotp} className="totp-form">
                <p>Authenticator sign-in is on for the admin account.</p>
                <div className="form-field">
                  <label htmlFor="totp-disable">Current authenticator code</label>
                  <input
                    id="totp-disable"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={8}
                    required
                  />
                </div>
                <button className="btn btn-secondary" type="submit" disabled={busy}>
                  {busy ? 'Turning off...' : 'Turn off authenticator'}
                </button>
              </form>
            ) : setup ? (
              <form onSubmit={enableTotp} className="totp-form">
                <p>Scan this QR code in Google Authenticator, then enter the 6-digit code it shows.</p>
                <img className="totp-qr" src={setup.qrDataUrl} alt="Authenticator QR code" />
                <p className="settings-intro">
                  Or enter this key manually: <code>{setup.secret}</code>
                </p>
                <div className="form-field">
                  <label htmlFor="totp-enable" className="required">
                    Authenticator code
                  </label>
                  <input
                    id="totp-enable"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={8}
                    required
                  />
                </div>
                <div className="actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Enabling...' : 'Enable authenticator'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setSetup(null);
                      setCode('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-primary" type="button" onClick={startSetup} disabled={busy}>
                {busy ? 'Preparing...' : 'Set up Google Authenticator'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">Appearance</div>
        <div className="settings-section">
          <p className="settings-intro">
            Choose a theme for the whole app. Your selection is saved on this device.
          </p>
          <div className="theme-grid" role="radiogroup" aria-label="App theme">
            {THEMES.map((option) => {
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-card${selected ? ' selected' : ''}`}
                  onClick={() => setTheme(option.id)}
                >
                  <div className="theme-preview" aria-hidden="true">
                    {option.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </div>
                  <div className="theme-card-title">{option.label}</div>
                  <div className="theme-card-desc">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
