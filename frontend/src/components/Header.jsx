import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-logo">C</div>
        <div>
          <div className="brand-name">CST-SFBS</div>
          <div className="brand-sub">Royal University of Bhutan</div>
        </div>
      </div>
      <nav className="nav">
        <Link to="/" className={isActive('/')}>Home</Link>
        <Link to="/facilities" className={isActive('/facilities')}>Facilities</Link>
        <Link to="/my-bookings" className={isActive('/my-bookings')}>My Bookings</Link>
        {user?.role === 'admin' && <Link to="/admin" className={isActive('/admin')}>Admin</Link>}
      </nav>
      {user ? (
        <div className="user-pill">
          {user.full_name}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ marginLeft: 8 }}>Logout</a>
        </div>
      ) : (
        <Link to="/login" className="user-pill" style={{ textDecoration: 'none' }}>Sign in</Link>
      )}
    </header>
  );
}

export default Header;