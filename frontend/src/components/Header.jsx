import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import UserMenu from './UserMenu';
import './Header.css';

function AdminNavIcon({ to }) {
  const paths = {
    '/admin/dashboard': <><path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
    '/admin/bookings': <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 9h16m-11 4h3m-3 3h6" /></>,
    '/admin/facilities': <><path d="M3 20h18M5 20V8l7-4 7 4v12" /><path d="M9 20v-6h6v6M8 10h.1M12 10h.1M16 10h.1" /></>,
    '/admin/users': <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1Zm11-8a3 3 0 1 0 0-6m1.5 9.5a4.5 4.5 0 0 1 4.5 4.5" /></>,
    '/admin/maintenance': <><path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3Z" /><path d="m4 17 3 3" /></>,
    '/admin/tournaments': <><path d="M8 4h8v4a4 4 0 0 1-8 0Zm4 8v5m-4 3h8m-8-3h8M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4" /></>,
    '/admin/reports': <><path d="M4 19V5m0 14h16" /><path d="M7 15v-3m4 3V8m4 7v-5m4 5V6" /></>,
    '/admin/settings': <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></>,
  };

  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[to] || <><circle cx="12" cy="12" r="8" /><path d="M8 12h8m-4-4v8" /></>}
    </svg>
  );
}

function Header({ links, homeTo = '/' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoTransition, setLogoTransition] = useState('idle');
  const transitionTimeoutRef = useRef(null);
  const skipTransitionRef = useRef(null);
  const navRef = useRef(null);
  const adminTabBarRef = useRef(null);
  const isAdminNavigation = Boolean(links);
  const quickAdminLinks = links?.filter(({ to }) => (
    ['/admin/dashboard', '/admin/bookings', '/admin/facilities', '/admin/users'].includes(to)
  )) || [];
  const moreAdminLinksActive = isAdminNavigation && !quickAdminLinks.some(({ to }) => location.pathname.startsWith(to));
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => () => window.clearTimeout(transitionTimeoutRef.current), []);
  useEffect(() => {
    if (logoTransition !== 'intro') return undefined;
    skipTransitionRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') finishLogoTransition();
      if (event.key === 'Tab') {
        event.preventDefault();
        skipTransitionRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logoTransition]);

  const finishLogoTransition = () => {
    window.clearTimeout(transitionTimeoutRef.current);
    setLogoTransition('leaving');
    transitionTimeoutRef.current = window.setTimeout(() => {
      navigate(homeTo);
      setLogoTransition('idle');
    }, 320);
  };

  const handleLogoClick = (event) => {
    if (homeTo !== '/' || logoTransition !== 'idle') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    setLogoTransition('intro');
    transitionTimeoutRef.current = window.setTimeout(() => {
      setLogoTransition('leaving');
      transitionTimeoutRef.current = window.setTimeout(() => {
        navigate(homeTo);
        setLogoTransition('idle');
      }, 320);
    }, 1750);
  };
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const updateFooterPosition = () => {
      if (!window.matchMedia('(max-width: 600px)').matches) {
        nav.style.removeProperty('--footer-offset');
        nav.classList.remove('is-footer-past');
        return;
      }

      const footer = document.querySelector('.footer');
      if (!footer) return;
      const footerTop = footer.getBoundingClientRect().top;
      const footerOffset = Math.max(0, window.innerHeight - footerTop);
      nav.style.setProperty('--footer-offset', `${footerOffset}px`);
      nav.classList.toggle(
        'is-footer-past',
        footerTop <= nav.offsetHeight + 1,
      );
    };

    const initialUpdate = window.requestAnimationFrame(updateFooterPosition);
    window.addEventListener('scroll', updateFooterPosition, { passive: true });
    window.addEventListener('resize', updateFooterPosition);
    return () => {
      window.cancelAnimationFrame(initialUpdate);
      window.removeEventListener('scroll', updateFooterPosition);
      window.removeEventListener('resize', updateFooterPosition);
    };
  }, []);
  useEffect(() => {
    const tabBar = adminTabBarRef.current;
    if (!tabBar) return undefined;

    const updateFooterPosition = () => {
      if (!window.matchMedia('(max-width: 600px)').matches) {
        tabBar.style.removeProperty('--footer-offset');
        tabBar.classList.remove('is-footer-past');
        return;
      }

      const footer = document.querySelector('.admin-dashboard > .footer');
      if (!footer) return;
      const footerTop = footer.getBoundingClientRect().top;
      const footerOffset = Math.max(0, window.innerHeight - footerTop);
      tabBar.style.setProperty('--footer-offset', `${footerOffset}px`);
      tabBar.classList.toggle('is-footer-past', footerTop <= tabBar.offsetHeight + 1);
    };

    const initialUpdate = window.requestAnimationFrame(updateFooterPosition);
    window.addEventListener('scroll', updateFooterPosition, { passive: true });
    window.addEventListener('resize', updateFooterPosition);
    return () => {
      window.cancelAnimationFrame(initialUpdate);
      window.removeEventListener('scroll', updateFooterPosition);
      window.removeEventListener('resize', updateFooterPosition);
    };
  }, []);
  const isActive = (path) => (location.pathname === path ? 'active' : '');
  // Custom links (admin) stay highlighted on sub-paths too.
  const isActiveSection = (path) => (location.pathname.startsWith(path) ? 'active' : '');

  return (
    <header className={`header${links ? ' has-custom-nav' : ' has-primary-tabs'}`}>
      <Link to={homeTo} className="nav-brand" aria-label="CST-SFBS home" onClick={handleLogoClick}>
        <img src="/images/logo.png" alt="CST-SFBS logo" className="nav-logo-img" />
      </Link>
      {!isAdminNavigation && (
        <button
          type="button"
          className={`mobile-menu-button${menuOpen ? ' is-open' : ''}`}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      )}
      <nav ref={navRef} id="primary-navigation" aria-label={links ? 'Admin navigation' : undefined} className={`nav${links ? ' nav-custom' : ''}${menuOpen ? ' is-open' : ''}`}>
        {links ? (
          links.map((l) => (
            <Link key={l.to} to={l.to} className={isActiveSection(l.to)} aria-current={isActiveSection(l.to) ? 'page' : undefined}>
              <AdminNavIcon to={l.to} />
              <span>{l.label}</span>
            </Link>
          ))
        ) : (
          <>
            <Link to="/" className={isActive('/')}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3.6 10.6 8.2-6.9 8.6 6.8M5.7 9.2v10.5c0 .4.3.7.7.7h11.3c.4 0 .7-.3.7-.7V9.2M9.1 20.2v-6.4c0-.4.3-.7.7-.7h4.5c.4 0 .7.3.7.7v6.4" /></svg>
              <span>Home</span>
            </Link>
            <Link to="/facilities" className={isActive('/facilities')}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 20V9.1L12 4.5l7.8 4.6V20M4.2 20h15.6M8 20v-6.1c0-.5.4-.9.9-.9h6.2c.5 0 .9.4.9.9V20M8 9.4h.1M12 9.4h.1M16 9.4h.1" /></svg>
              <span>Facilities</span>
            </Link>
            <Link to="/rules" className={isActive('/rules')} aria-current={isActive('/rules') ? 'page' : undefined}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" /><path d="M14.5 4v4.5H19M8.5 12h7m-7 3.5h7" /></svg>
              <span>Booking Rules</span>
            </Link>
            <Link to="/fees" className={isActive('/fees')} aria-current={isActive('/fees') ? 'page' : undefined}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.7-.7-1.7-1-3-1-1.6 0-2.7.8-2.7 2s1 1.8 2.7 2.3 2.7 1.1 2.7 2.4-1.2 2.2-3 2.2c-1.2 0-2.4-.4-3.2-1.2M12 5.5v13" /></svg>
              <span>Fee Structure</span>
            </Link>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 5.8h13.6c.8 0 1.4.6 1.4 1.4v11.2c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4V7.2c0-.8.6-1.4 1.4-1.4ZM7.7 3.8v4M16.3 3.8v4M4 10.1h16M7.3 13.8l1.2 1.2 2-2.1M13.5 14h3.2M13.5 17h3.2" /></svg>
              <span>My Bookings</span>
            </Link>
            <Link to="/help" className={isActive('/help')}>
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.4a7.8 7.8 0 0 1-8 7.6 8.7 8.7 0 0 1-3.7-.8L4 19.5l1-3.5a7.2 7.2 0 0 1-1.1-3.8A7.8 7.8 0 0 1 12 4.6a7.8 7.8 0 0 1 8 6.8Z" /><path d="M9.4 9.5a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.1.8-1.1 1.7M11.5 16.8h.1" /></svg>
              <span>Help &amp; Contact</span>
            </Link>
          </>
        )}
      </nav>
      {user ? (
        <UserMenu />
      ) : (
        <Link to="/login" className="user-pill" style={{ textDecoration: 'none' }}>Sign in</Link>
      )}
      {isAdminNavigation && (
        <nav ref={adminTabBarRef} className="admin-mobile-tabbar" aria-label="Admin quick navigation">
          {quickAdminLinks.map((link) => {
            const active = location.pathname.startsWith(link.to);
            return (
              <Link key={link.to} to={link.to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                <AdminNavIcon to={link.to} />
                <span>{link.key === 'Facilities Status' ? 'Facilities' : link.key === 'Users' ? 'Users' : link.key}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={moreAdminLinksActive ? 'active' : ''}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <AdminNavIcon to="/admin/more" />
            <span>More</span>
          </button>
        </nav>
      )}
      {logoTransition !== 'idle' && (
        <div
          className={`logo-home-transition${logoTransition === 'leaving' ? ' is-leaving' : ''}`}
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
            ref={skipTransitionRef}
            className="logo-transition-skip"
            type="button"
            onClick={finishLogoTransition}
          >
            Skip intro
          </button>
        </div>
      )}
    </header>
  );
}

export default Header;