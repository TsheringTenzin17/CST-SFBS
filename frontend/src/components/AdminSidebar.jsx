// This file holds the list of links for the admin area.
// "key" is the name that AdminDashboard checks to know which page is active.
// "label" is the text shown in the header menu.
// The Header and Footer are the shared client components, so they are not defined here.

export const ADMIN_NAV = [                                                   // Export an array so other files can import it
  { to: '/admin/dashboard', key: 'Dashboard', label: 'Dashboard' },          // Main dashboard page; menu text is "Dashboard"
  { to: '/admin/bookings', key: 'Bookings', label: 'Manage Bookings' },      // Bookings page; menu text is "Manage Bookings"
  { to: '/admin/facilities', key: 'Facilities Status', label: 'Facilities Status' }, // Facilities page; shows the status of facilities
  { to: '/admin/maintenance', key: 'Maintenance Blocks', label: 'Maintenance Blocks' }, // Maintenance page; for blocking facilities for repair
  { to: '/admin/tournaments', key: 'Tournaments', label: 'Tournaments' },    // Tournaments page; for managing tournaments
  { to: '/admin/users', key: 'Users', label: 'Registered Users' },          // Users page; menu text is "Registered Users"
  { to: '/admin/reports', key: 'Reports', label: 'Reports & Analytics' },    // Reports page; menu text is "Reports & Analytics"
  { to: '/admin/settings', key: 'System Settings', label: 'System Settings', hidden: true },    // Moved into the user dropdown, so it is hidden from the header
  // This link is not shown in the header, so the header stays at 8 links.
  // It is opened from the System Settings page instead.
  { to: '/admin/support', key: 'Support Requests', label: 'Support Requests', hidden: true }, // "hidden: true" means do not show this in the header menu
];                                                                           // End of the array