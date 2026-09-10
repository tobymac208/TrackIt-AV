import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/offices', label: 'Offices' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/hardware', label: 'Hardware' },
  { to: '/inventory', label: 'Inventory', adminOnly: true },
];

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>AV Tracker</h1>
          <p>Hardware Lifecycle</p>
        </div>
        <nav className="sidebar-nav">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                {label}
              </NavLink>
            ))}
        </nav>
        <nav className="sidebar-nav sidebar-nav-footer">
          <div className="sidebar-user">
            <strong>{user.username}</strong>
            <span>{isAdmin ? 'Admin' : 'View only'}</span>
          </div>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Settings
          </NavLink>
          <button type="button" className="nav-link nav-sign-out" onClick={logout}>
            Sign out
          </button>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
