// key = what AdminDashboard checks, label = what the header menu shows.
// (The header and footer themselves are the shared client Header / Footer.)
export const ADMIN_NAV = [
  { to: '/admin/dashboard',   key: 'Dashboard',          label: 'Dashboard' },
  { to: '/admin/bookings',    key: 'Bookings',           label: 'Manage Bookings' },
  { to: '/admin/facilities',  key: 'Facilities Status',  label: 'Facilities Status' },
  { to: '/admin/maintenance', key: 'Maintenance Blocks', label: 'Maintenance Blocks' },
  { to: '/admin/tournaments', key: 'Tournaments',        label: 'Tournaments' },
  { to: '/admin/users',       key: 'Users',              label: 'Registered Users' },
  { to: '/admin/reports',     key: 'Reports',            label: 'Reports & Analytics' },
  { to: '/admin/support',     key: 'Support Requests',   label: 'System Settings' },
];
