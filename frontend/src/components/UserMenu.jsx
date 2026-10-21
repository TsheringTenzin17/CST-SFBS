import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './UserMenu.css';

// "TSHERING EUDEN" -> "Tshering Euden"
const titleCase = (s = '') => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const icon = {
  width: 18, height: 18, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click or Escape
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/');
  };

  const name = titleCase(user.full_name ?? user.name ?? '');
  const role = titleCase(user.role || 'Student');

  return (
    <div className="user-menu" ref={ref}>
      {/* Pill (image 3) */}
      <button
        ref={btnRef}
        type="button"
        className="user-menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg {...icon}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M6.17 18.9a7 7 0 0 1 11.66 0" /></svg>
        <span className="user-menu-btn-name">{name}</span>
        <svg {...icon} width="16" height="16" className={`user-menu-chevron ${open ? 'open' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {/* Dropdown (image 4) */}
      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-head">
            <div className="user-menu-avatar">
              <svg {...icon} width="22" height="22"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            </div>
            <div className="user-menu-who">
              <div className="user-menu-name">{name}</div>
              <div className="user-menu-role">{role}</div>
            </div>
            <svg {...icon} width="16" height="16" className="user-menu-check"><path d="M20 6 9 17l-5-5" /></svg>
          </div>

          <div className="user-menu-divider" />

          <Link to="/settings" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            <svg {...icon}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
            Profile &amp; Settings
          </Link>
          <Link to="/my-bookings" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            <svg {...icon}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            My Bookings
          </Link>
          <Link to="/notifications" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            <svg {...icon}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
            Notifications
          </Link>
          <div className="user-menu-divider" />

          <button type="button" role="menuitem" className="user-menu-item user-menu-logout" onClick={handleLogout}>
            <svg {...icon}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;