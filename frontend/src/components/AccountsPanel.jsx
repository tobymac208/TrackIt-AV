import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth';
import { RESOURCES, defaultNewUserPermissions } from '../permissions';

const MAX_ADMINS = 3;

function PermissionFields({ value, onChange, disabled }) {
  return (
    <div className="permission-grid">
      {RESOURCES.map((resource) => (
        <div key={resource.id} className="permission-row">
          <span>{resource.label}</span>
          <label>
            <input
              type="checkbox"
              checked={Boolean(value[resource.id]?.read || value[resource.id]?.write)}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  [resource.id]: {
                    read: e.target.checked,
                    write: e.target.checked ? Boolean(value[resource.id]?.write) : false,
                  },
                })
              }
            />
            View
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(value[resource.id]?.write)}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  [resource.id]: {
                    read: e.target.checked || Boolean(value[resource.id]?.read),
                    write: e.target.checked,
                  },
                })
              }
            />
            Edit
          </label>
        </div>
      ))}
    </div>
  );
}

export default function AccountsPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'user',
    permissions: defaultNewUserPermissions(),
  });
  const [resetPasswords, setResetPasswords] = useState({});

  const load = () => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const adminCount = users.filter((item) => item.role === 'admin' && !item.disabled).length;
  const canAddAdmin = adminCount < MAX_ADMINS;

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.createUser({
        username: form.username,
        password: form.password,
        role: form.role,
        permissions: form.role === 'admin' ? undefined : form.permissions,
      });
      setForm({ username: '', password: '', role: 'user', permissions: defaultNewUserPermissions() });
      setMessage('Account created. They must set up Google Authenticator and change the password on first sign-in.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async (item, updates) => {
    setError('');
    setMessage('');
    try {
      await api.updateUser(item.id, updates);
      setMessage(`Updated ${item.username}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeUser = async (item) => {
    if (!window.confirm(`Delete account "${item.username}"?`)) return;
    setError('');
    try {
      await api.deleteUser(item.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel" style={{ marginBottom: '1.5rem' }}>
      <div className="panel-header">Accounts</div>
      <div className="settings-section">
        <p className="settings-intro">
          Create additional administrators (up to {MAX_ADMINS} total) or permissioned users. New accounts require
          Google Authenticator.
        </p>
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}

        <form onSubmit={createUser} className="account-create-form">
          <h3>Add account</h3>
          <div className="form-grid">
            <div className="form-field">
              <label className="required">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label className="required">Temporary password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="form-field">
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
              >
                <option value="user">Custom permissions</option>
                <option value="admin" disabled={!canAddAdmin}>
                  Administrator {canAddAdmin ? '' : '(limit reached)'}
                </option>
              </select>
            </div>
          </div>
          {form.role === 'user' && (
            <PermissionFields
              value={form.permissions}
              onChange={(permissions) => setForm((current) => ({ ...current, permissions }))}
            />
          )}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>MFA</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.username}</strong>
                    {item.id === user.id && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>You</div>
                    )}
                  </td>
                  <td>{item.role === 'admin' ? 'Administrator' : 'Custom'}</td>
                  <td>{item.totpEnabled ? 'On' : item.mfaRequired ? 'Required' : 'Off'}</td>
                  <td>{item.disabled ? 'Disabled' : 'Active'}</td>
                  <td>
                    <div className="account-actions">
                      {item.role === 'user' && (
                        <PermissionFields
                          value={item.permissions}
                          onChange={(permissions) => saveUser(item, { permissions })}
                        />
                      )}
                      {item.role === 'user' && canAddAdmin && (
                        <button className="btn btn-secondary btn-sm" onClick={() => saveUser(item, { role: 'admin' })}>
                          Make admin
                        </button>
                      )}
                      {item.role === 'admin' && item.id !== user.id && (
                        <button className="btn btn-secondary btn-sm" onClick={() => saveUser(item, { role: 'user' })}>
                          Make custom user
                        </button>
                      )}
                      {item.id !== user.id && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => saveUser(item, { disabled: !item.disabled })}
                        >
                          {item.disabled ? 'Enable' : 'Disable'}
                        </button>
                      )}
                      {item.id !== user.id && (
                        <div className="account-reset">
                          <input
                            type="password"
                            placeholder="Reset password"
                            value={resetPasswords[item.id] || ''}
                            onChange={(e) =>
                              setResetPasswords((current) => ({ ...current, [item.id]: e.target.value }))
                            }
                            minLength={8}
                          />
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            disabled={(resetPasswords[item.id] || '').length < 8}
                            onClick={() => {
                              saveUser(item, { password: resetPasswords[item.id] });
                              setResetPasswords((current) => ({ ...current, [item.id]: '' }));
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      )}
                      {item.id !== user.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeUser(item)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
