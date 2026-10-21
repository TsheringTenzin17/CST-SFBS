import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Facilities from './pages/Facilities';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import BookingForm from './pages/BookingForm';
import BookingConfirmation from './pages/BookingConfirmation';
import FacilityDetail from './pages/FacilityDetail';
import Rules from './pages/Rules';
import Contact from './pages/Contact';

function ClientPage({ children, requiresAuth = false }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <main className="main" role="status">Checking your session…</main>;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (requiresAuth && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function AdminPage({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <main className="main" role="status">Checking your session…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role !== 'admin') {
    return (
      <main className="admin-denied">
        <h1>This page is for admins only</h1>
        <Link to="/">Return to the client homepage</Link>
      </main>
    );
  }
  return children;
}

function AuthPage({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <main className="main" role="status">Checking your session…</main>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function App() {
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();
  const hideChrome =
    isLoading || user?.role === 'admin' || pathname === '/login' ||
    pathname === '/register' || pathname.startsWith('/admin');

  return (
    <div className="page">
      {!hideChrome && <Header />}
      <Routes>
        <Route path="/" element={<ClientPage><Home /></ClientPage>} />
        <Route path="/facilities" element={<ClientPage><Facilities /></ClientPage>} />
        <Route path="/login" element={<AuthPage><Login /></AuthPage>} />
        <Route path="/register" element={<AuthPage><Register /></AuthPage>} />
        <Route path="/admin/*" element={<AdminPage><AdminDashboard /></AdminPage>} />
        <Route path="/book" element={<ClientPage requiresAuth><BookingForm /></ClientPage>} />
        <Route path="/booking-confirmed" element={<ClientPage requiresAuth><BookingConfirmation /></ClientPage>} />
        <Route path="/facilities/:id" element={<ClientPage><FacilityDetail /></ClientPage>} />
        <Route path="/rules" element={<ClientPage><Rules /></ClientPage>} />
        <Route path="/help" element={<ClientPage><Contact /></ClientPage>} />
      </Routes>
      {!hideChrome && <Footer />}
    </div>
  );
}

export default App;