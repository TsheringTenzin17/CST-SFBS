import { Routes, Route, useLocation } from 'react-router-dom';
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

function App() {
  const { pathname } = useLocation();
  const hideChrome =
    pathname === '/login' || pathname === '/register' || pathname.startsWith('/admin');

  return (
    <div className="page">
      {!hideChrome && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/book" element={<BookingForm />} />
        <Route path="/booking-confirmed" element={<BookingConfirmation />} />
        <Route path="/facilities/:id" element={<FacilityDetail />} />
        <Route path="/rules" element={<Rules />} />
      </Routes>
      {!hideChrome && <Footer />}
    </div>
  );
}

export default App;