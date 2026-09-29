import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();
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
      </nav>
      <div className="user-pill">user</div>
    </header>
  );
}

export default Header;