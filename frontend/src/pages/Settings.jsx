import { NavLink, Outlet } from 'react-router-dom';

const settingsNav = [
  { to: '/settings/accounts', label: 'Accounts', description: 'Password and user access' },
  { to: '/settings/mfa', label: 'MFA', description: 'Google Authenticator' },
  { to: '/settings/theme', label: 'Theme', description: 'App appearance' },
];

export default function Settings() {
  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Account security and preferences</p>
        </div>
      </div>
      <div className="settings-shell">
        <nav className="settings-vpanel" aria-label="Settings sections">
          {settingsNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'settings-vpanel-link active' : 'settings-vpanel-link')}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </NavLink>
          ))}
        </nav>
        <div className="settings-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
