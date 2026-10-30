import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ADMIN_NAV } from '../components/AdminSidebar';
import AdminOverview from './AdminOverview';
import AdminBookings from './AdminBookings';
import AdminFacilities from './AdminFacilities';
import AdminFacilityForm from './AdminFacilityForm';
import AdminMaintenance from './AdminMaintenance';
import AdminTournaments from './AdminTournaments';
import AdminUsers from './AdminUsers';
import AdminUserDetail from './AdminUserDetail';
import AdminReports from './AdminReports';
import AdminSupport from './AdminSupport';
import AdminSettings from './AdminSettings';
import './admin.css';

// Tabs that just wrap an existing page component
const SIMPLE_TABS = {
  Tournaments: { title: 'Tournament Dates', Component: AdminTournaments },
  Users: { title: 'Registered Users', Component: AdminUsers },
  'Support Requests': { title: 'Support Requests', Component: AdminSupport },
};

const ADMIN_FOOTER_LINKS = [
  { to: '/admin/bookings', label: 'Manage Bookings' },
  { to: '/admin/facilities', label: 'Facilities Status' },
  { to: '/admin/users', label: 'Registered Users' },
  { to: '/admin/maintenance', label: 'Maintenance Blocks' },
  { to: '/admin/reports', label: 'Reports & Analytics' },
];

function AdminDashboard() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // The tab comes from the URL so refresh and the back button work
  const current = ADMIN_NAV.find((item) => pathname.startsWith(item.to)) || ADMIN_NAV[0];
  const activeTab = current.key;

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/bookings');
      if (!Array.isArray(data)) throw new Error('The bookings response was not a list.');
      setBookings(data);
    } catch (e) {
      setError(e.message || 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // /admin/users/:id opens the single-account page instead of the list
  const userDetail = pathname.match(/^\/admin\/users\/(\d+)\/?$/);
  const simple = userDetail ? null : SIMPLE_TABS[activeTab];

  return (
    <div className="admin-dashboard">
      <Header links={ADMIN_NAV.filter((item) => !item.hidden)} homeTo="/admin/dashboard" />

      <main className="admin-content">
        {activeTab === 'Dashboard' ? (
          <AdminOverview bookingList={bookings} user={user} onReload={loadBookings} />
        ) : activeTab === 'Facilities Status' ? (
          /^\/admin\/facilities\/new\/?$/.test(pathname) ? <AdminFacilityForm /> : <AdminFacilities />
        ) : activeTab === 'System Settings' ? (
          <AdminSettings />
        ) : userDetail || ['Bookings', 'Maintenance Blocks', 'Reports'].includes(activeTab) ? null : (
          <header className="admin-page-header">
            <h1>{current.label}</h1>
            <p>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}. Here’s the latest on your sports facilities.</p>
          </header>
        )}

        {activeTab === 'Bookings' && (
          <AdminBookings bookingList={bookings} loading={loading} error={error} onReload={loadBookings} />
        )}

        {activeTab === 'Maintenance Blocks' && <AdminMaintenance />}

        {activeTab === 'Reports' && <AdminReports />}

        {userDetail && <AdminUserDetail userId={Number(userDetail[1])} />}

        {simple && (
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>{simple.title}</h2></div>
            <simple.Component />
          </section>
        )}
      </main>

      <Footer heading="Admin tools" links={ADMIN_FOOTER_LINKS} />
    </div>
  );
}

export default AdminDashboard;
