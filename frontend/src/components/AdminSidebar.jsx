import { useState } from 'react';
import { NavLink } from 'react-router-dom';

// key = what AdminDashboard checks, label = what the sidebar shows
export const ADMIN_NAV = [
  { to: '/admin/dashboard',   key: 'Dashboard',          label: 'Dashboard' },
  { to: '/admin/bookings',    key: 'Bookings',           label: 'Manage Bookings' },
  { to: '/admin/maintenance', key: 'Maintenance Blocks', label: 'Maintenance Blocks' },
  { to: '/admin/users',       key: 'Users',              label: 'Registered Users' },
  { to: '/admin/reports',     key: 'Reports',            label: 'Reports & Analysis' },
  { to: '/admin/support',     key: 'Support Requests',   label: 'System Settings' },
];

export default function AdminSidebar({ onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="adm-menu-btn" aria-expanded={open} aria-controls="adm-sidebar" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>

      <aside id="adm-sidebar" className={`adm-sidebar ${open ? 'open' : ''}`}>
        <div className="adm-brand">
          <img src="/images/logo.png" alt="" className="adm-logo" />
          <b>CST-SFBS</b>
          <small>College of Science and Technology</small>
        </div>

        <nav className="adm-nav" aria-label="Admin">
          {ADMIN_NAV.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        {onLogout && <button className="adm-logout" onClick={onLogout}>Log out</button>}
      </aside>
    </>
  );
}