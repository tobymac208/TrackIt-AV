import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/offices', label: 'Offices', resource: 'offices' },
  { to: '/jobsites', label: 'Job Sites', resource: 'rooms' },
  { to: '/rooms', label: 'Rooms', resource: 'rooms' },
  { to: '/hardware', label: 'Hardware', resource: 'hardware' },
  { to: '/inventory', label: 'Inventory', resource: 'inventory' },
];

export default function Layout({ children }) {
  const { user, isAdmin, can, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <aside className={`sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <h1>TrackIt! AV</h1>
            <p>Hardware Lifecycle</p>
          </div>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-controls="app-navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <div id="app-navigation" className="sidebar-menus">
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
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
