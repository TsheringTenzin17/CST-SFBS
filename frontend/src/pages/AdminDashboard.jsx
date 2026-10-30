import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import AdminSidebar, { ADMIN_NAV } from '../components/AdminSidebar';
import AdminOverview from './AdminOverview';
import AdminBookings from './AdminBookings';
import AdminMaintenance from './AdminMaintenance';
import AdminTournaments from './AdminTournaments';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminSupport from './AdminSupport';
import './admin.css';

// Tabs that just wrap an existing page component
const SIMPLE_TABS = {
  'Maintenance Blocks': { title: 'Maintenance Blocks', Component: AdminMaintenance },
  Tournaments: { title: 'Tournament Dates', Component: AdminTournaments },
  Users: { title: 'Registered Users', Component: AdminUsers },
  Reports: { title: 'Reports & Analytics', Component: AdminReports },
  'Support Requests': { title: 'Support Requests', Component: AdminSupport },
};

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const simple = SIMPLE_TABS[activeTab];

  return (
    <div className="admin-dashboard">
      <AdminSidebar onLogout={handleLogout} />

      <main className="admin-content">
        <header className="admin-page-header">
          <h1>{current.label}</h1>
          <p>Welcome back{user?.full_name ? `, ${user.full_name}` : ''}. Here’s the latest on your sports facilities.</p>
        </header>

        {activeTab === 'Dashboard' && <AdminOverview bookingList={bookings} />}

        {activeTab === 'Bookings' && (
          <AdminBookings bookingList={bookings} loading={loading} error={error} onReload={loadBookings} />
        )}

        {simple && (
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>{simple.title}</h2></div>
            <simple.Component />
          </section>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
