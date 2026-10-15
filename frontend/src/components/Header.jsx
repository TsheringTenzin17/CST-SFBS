import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import UserMenu from './UserMenu';

function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <header className="header">
      <Link to="/" className="nav-brand">
      <img src="/images/logo.png" alt="CST-SFBS logo" className="nav-logo-img" />
    </Link>
      <nav className="nav">
        <Link to="/" className={isActive('/')}>Home</Link>
        <Link to="/facilities" className={isActive('/facilities')}>Facilities</Link>
        <Link to="/my-bookings" className={isActive('/my-bookings')}>My Bookings</Link>
        {user?.role === 'admin' && <Link to="/admin" className={isActive('/admin')}>Admin</Link>}
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