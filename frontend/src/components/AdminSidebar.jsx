import { NavLink } from 'react-router-dom';

// The ONE admin menu. To add or rename an admin page, change this list only.
export const ADMIN_NAV = [
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/maintenance', label: 'Maintenance Blocks' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/support', label: 'Support Requests' },
  { to: '/admin/reports', label: 'Reports' },
];

function AdminSidebar({ onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark">C</span>
        <span>CST-SFBS</span>
      </div>
      <nav className="admin-nav" aria-label="Admin navigation">
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `admin-nav-item${isActive ? ' is-active' : ''}`}
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button className="admin-nav-item admin-logout" onClick={onLogout} type="button">
          Sign out
        </button>
      </nav>
    </aside>
  );
}

export default AdminSidebar;
