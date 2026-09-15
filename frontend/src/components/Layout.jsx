import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/offices', label: 'Offices', resource: 'offices' },
  { to: '/rooms', label: 'Rooms', resource: 'rooms' },
  { to: '/hardware', label: 'Hardware', resource: 'hardware' },
  { to: '/inventory', label: 'Inventory', resource: 'inventory' },
];

export default function Layout({ children }) {
  const { user, isAdmin, can, logout } = useAuth();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>TrackIt! AV</h1>
          <p>Hardware Lifecycle</p>
        </div>
        <nav className="sidebar-nav">
          {navItems
            .filter((item) => !item.resource || can(item.resource, 'read'))
            .map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                {label}
              </NavLink>
            ))}
        </nav>
        <nav className="sidebar-nav sidebar-nav-footer">
          <div className="sidebar-user">
            <strong>{user.username}</strong>
            <span>{isAdmin ? 'Admin' : 'Custom access'}</span>
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
