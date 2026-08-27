import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/offices', label: 'Offices' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/hardware', label: 'Hardware' },
];

export default function Layout({ children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>AV Tracker</h1>
          <p>Hardware Lifecycle</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
