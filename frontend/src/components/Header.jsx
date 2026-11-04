import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import UserMenu from './UserMenu';
import './Header.css';

function Header({ links, homeTo = '/' }) {
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  const isActive = (path) => (location.pathname === path ? 'active' : '');
  // Custom links (admin) stay highlighted on sub-paths too.
  const isActiveSection = (path) => (location.pathname.startsWith(path) ? 'active' : '');

  return (
    <header className="header">
      <Link to={homeTo} className="nav-brand">
      <img src="/images/logo.png" alt="CST-SFBS logo" className="nav-logo-img" />
    </Link>
      <button
        type="button"
        className={`mobile-menu-button${menuOpen ? ' is-open' : ''}`}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="primary-navigation" className={`nav${links ? ' nav-custom' : ''}${menuOpen ? ' is-open' : ''}`}>
        {links ? (
          links.map((l) => (
            <Link key={l.to} to={l.to} className={isActiveSection(l.to)}>{l.label}</Link>
          ))
        ) : (
          <>
            <Link to="/" className={isActive('/')}>
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2M5.5 10v10h13V10M9 20v-6h6v6" /></svg>
              <span>Home</span>
            </Link>
            <Link to="/facilities" className={isActive('/facilities')}>
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11M8 20v-7h8v7M3 20h18" /></svg>
              <span>Facilities</span>
            </Link>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M7 14h3M14 14h3M7 17h3" /></svg>
              <span>My Bookings</span>
            </Link>
            <Link to="/help" className={isActive('/help')}>
              <svg className="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.1 2.3c-.8.4-.8 1-.8 1.7M12 17h.01" /></svg>
              <span>Help &amp; Contact</span>
            </Link>
          </>
        )}
      </nav>
      {user ? (
        <UserMenu />
      ) : (
        <Link to="/login" className="user-pill" style={{ textDecoration: 'none' }}>Sign in</Link>
      )}
    </header>
  );
}

export default Header;