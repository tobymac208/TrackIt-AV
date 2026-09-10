import { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
  const { login, completeTotpLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login(username, password);
      if (result?.requiresTotp) {
        setChallengeToken(result.challengeToken);
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTotpSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await completeTotpLogin(challengeToken, code);
    } catch (err) {
      setError(err.message || 'Invalid authenticator code');
    } finally {
      setSubmitting(false);
    }
  };

  if (challengeToken) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleTotpSubmit}>
          <div className="login-brand">
            <h1>AV Tracker</h1>
            <p>Enter the 6-digit code from Google Authenticator</p>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-field">
            <label htmlFor="totp-code" className="required">
              Authenticator code
            </label>
            <input
              id="totp-code"
              name="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              required
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setChallengeToken('');
              setCode('');
              setError('');
            }}
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handlePasswordSubmit}>
        <div className="login-brand">
          <h1>AV Tracker</h1>
          <p>Sign in to view hardware inventory</p>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-field">
          <label htmlFor="username" className="required">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="password" className="required">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
