import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import CancellationConfirmation from './pages/CancellationConfirmation';
import MyBookings from './pages/Mybookings';
import RescheduleBooking from './pages/RescheduleBooking';
import Notifications from './pages/Notifications';
import ProfileSettings from './pages/ProfileSettings';
import ContactConfirmation from './pages/ContactConfirmation';
import RegistrationSuccess from './pages/RegistrationSuccess';
import VerifyEmail from './pages/VerifyEmail';
import ConfirmEmailChange from './pages/ConfirmEmailChange';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FacilityDetail from './pages/FacilityDetail';
import Rules from './pages/Rules';
import FeeStructure from './pages/FeeStructure';
import Contact from './pages/Contact';
import ScrollToTop from './components/ScrollToTop';
import LiveNotice from './components/LiveNotice';
import { Spinner } from './components/Loading';

function ClientPage({ children, requiresAuth = false }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <main className="main session-loading"><Spinner label="Checking your session…" /></main>;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (requiresAuth && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function AdminPage({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <main className="main session-loading"><Spinner label="Checking your session…" /></main>;
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
  if (isLoading) return <main className="main session-loading"><Spinner label="Checking your session…" /></main>;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function App() {
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();
  const pageContentRef = useRef(null);
  const startupSkipRef = useRef(null);
  const [startupIntro, setStartupIntro] = useState(() => (
    typeof window !== 'undefined' &&
    window.location.pathname === '/' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'intro'
      : 'idle'
  ));
  const animatePage = pathname !== '/login' && pathname !== '/register';
  const hideChrome =
    isLoading || user?.role === 'admin' || pathname === '/login' ||
    pathname === '/register' || pathname === '/registration-success' ||
    pathname === '/verify-email' || pathname === '/forgot-password' ||
    pathname === '/confirm-email-change' ||
    pathname === '/reset-password' || pathname.startsWith('/admin');

  useLayoutEffect(() => {
    const pageContent = pageContentRef.current;
    if (!pageContent) return;

    pageContent.classList.remove('page-3d-transition');
    if (!animatePage) return;

    void pageContent.offsetWidth;
    pageContent.classList.add('page-3d-transition');
  }, [pathname, animatePage]);

  useEffect(() => {
    if (startupIntro !== 'intro') return undefined;

    startupSkipRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setStartupIntro('leaving');
      if (event.key === 'Tab') {
        event.preventDefault();
        startupSkipRef.current?.focus();
      }
    };
    const timer = window.setTimeout(() => setStartupIntro('leaving'), 1850);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [startupIntro]);

  useEffect(() => {
    if (startupIntro !== 'leaving') return undefined;
    const timer = window.setTimeout(() => setStartupIntro('idle'), 320);
    return () => window.clearTimeout(timer);
  }, [startupIntro]);

  return (
    <div className={`page${hideChrome ? '' : ' has-primary-tabs'}`}>
      <ScrollToTop />
      {!hideChrome && <Header />}
      {!hideChrome && <LiveNotice />}
      <div
        ref={pageContentRef}
        className={`page-content${animatePage ? ' page-3d-transition' : ''}`}
      >
        <Routes>
        <Route path="/" element={<ClientPage><Home /></ClientPage>} />
        <Route path="/facilities" element={<ClientPage><Facilities /></ClientPage>} />
        <Route path="/login" element={<AuthPage><Login /></AuthPage>} />
        <Route path="/register" element={<AuthPage><Register /></AuthPage>} />
        <Route path="/registration-success" element={<AuthPage><RegistrationSuccess /></AuthPage>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/*" element={<AdminPage><AdminDashboard /></AdminPage>} />
        <Route path="/book" element={<ClientPage requiresAuth><BookingForm /></ClientPage>} />
        <Route path="/booking-confirmed" element={<ClientPage requiresAuth><BookingConfirmation /></ClientPage>} />
        <Route path="/booking-cancelled" element={<ClientPage requiresAuth><CancellationConfirmation /></ClientPage>} />
        <Route path="/my-bookings" element={<ClientPage requiresAuth><MyBookings /></ClientPage>} />
        <Route path="/my-bookings/:id/reschedule" element={<ClientPage requiresAuth><RescheduleBooking /></ClientPage>} />
        <Route path="/notifications" element={<ClientPage requiresAuth><Notifications /></ClientPage>} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<ClientPage requiresAuth><ProfileSettings /></ClientPage>} />
        <Route path="/facilities/:id" element={<ClientPage><FacilityDetail /></ClientPage>} />
        <Route path="/rules" element={<ClientPage><Rules /></ClientPage>} />
        <Route path="/fees" element={<ClientPage><FeeStructure /></ClientPage>} />
        <Route path="/help" element={<ClientPage><Contact /></ClientPage>} />
        <Route path="/help/confirmation" element={<ClientPage><ContactConfirmation /></ClientPage>} />
      </Routes>
    </div>
    {startupIntro !== 'idle' && (
      <div
        className={`logo-home-transition${startupIntro === 'leaving' ? ' is-leaving' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-transition-title"
      >
        <div className="logo-transition-content">
          <span className="logo-transition-orbit" aria-hidden="true" />
          <img className="logo-transition-mark" src="/images/logo.png" alt="" />
          <p className="logo-transition-kicker">College of Science and Technology</p>
          <h2 id="logo-transition-title">Every game starts with a place.</h2>
          <p className="logo-transition-caption">Welcome to CST Sports Facilities Booking System</p>
        </div>
        <button
          ref={startupSkipRef}
          className="logo-transition-skip"
          type="button"
          onClick={() => setStartupIntro('leaving')}
        >
          Skip intro
        </button>
      </div>
    )}
    {!hideChrome && <Footer />}
  </div>
  );
}

export default App;