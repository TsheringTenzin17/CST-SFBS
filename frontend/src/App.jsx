<<<<<<< HEAD
import { Routes, Route, useLocation } from 'react-router-dom';
=======
import { Routes, Route, useLocation} from 'react-router-dom';
>>>>>>> origin/main
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Facilities from './pages/Facilities';
<<<<<<< HEAD
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const { pathname } = useLocation();
  const isAdminPage = pathname === '/admin';

  return (
    <div className="page">
      {!isAdminPage && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
      {!isAdminPage && <Footer />}
=======
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  const { pathname } = useLocation();
const hideChrome = pathname === '/login' || pathname === '/register';

  return (
    <div className="page">
      {!hideChrome && <Header />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      {!hideChrome && <Footer />}
>>>>>>> origin/main
    </div>
  );
}

export default App;