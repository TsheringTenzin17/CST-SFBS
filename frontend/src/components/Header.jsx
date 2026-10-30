import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import UserMenu from './UserMenu';
import './Header.css';

function Header({ links, homeTo = '/' }) {
  const location = useLocation();
  const { user } = useAuth();
  const isActive = (path) => (location.pathname === path ? 'active' : '');
  // Custom links (admin) stay highlighted on sub-paths too.
  const isActiveSection = (path) => (location.pathname.startsWith(path) ? 'active' : '');

  return (
    <header className="header">
      <Link to={homeTo} className="nav-brand">
      <img src="/images/white_logo.png" alt="CST-SFBS logo" className="nav-logo-img" />
    </Link>
      <nav className={`nav${links ? ' nav-custom' : ''}`}>
        {links ? (
          links.map((l) => (
            <Link key={l.to} to={l.to} className={isActiveSection(l.to)}>{l.label}</Link>
          ))
        ) : (
          <>
            <Link to="/" className={isActive('/')}>Home</Link>
            <Link to="/facilities" className={isActive('/facilities')}>Facilities</Link>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>My Bookings</Link>
            <Link to="/help" className={isActive('/help')}>Help &amp; Contact</Link>
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