import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';

export default function SettingsMfa() {
  const { user } = useAuth();
  const [totpEnabled, setTotpEnabled] = useState(Boolean(user?.totpEnabled));
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getTotpStatus()
      .then((status) => setTotpEnabled(Boolean(status.enabled)))
      .catch((err) => setError(err.message));
  }, []);

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
      setMessage('Authenticator sign-in is on. The next login will ask for a code.');
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
    <div className="panel">
      <div className="panel-header">Google Authenticator</div>
      <div className="settings-section">
        <p className="settings-intro">
          After you turn this on, signing in requires your password and a 6-digit code from Google Authenticator.
        </p>
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}

        {totpEnabled && !setup ? (
          <form onSubmit={disableTotp} className="totp-form">
            <p>Authenticator sign-in is on for this account.</p>
            {user?.mfaRequired && (
              <p className="settings-intro">This account requires authenticator sign-in and cannot turn it off.</p>
            )}
            {!user?.mfaRequired && (
              <>
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
              </>
            )}
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
  );
}
