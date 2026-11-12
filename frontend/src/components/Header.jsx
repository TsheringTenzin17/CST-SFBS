import { useEffect, useRef, useState } from 'react';                  // Import React tools: run code, hold values, store state
import { Link, useLocation, useNavigate } from 'react-router-dom';    // Import link, current page info, and page-change function
import { useAuth } from '../AuthContext';                             // Import the helper that tells who is logged in
import UserMenu from './UserMenu';                                    // Import the user name and dropdown menu
import './Header.css';                                                // Import the styles for the header
import NotificationBell from './NotificationBell';                    // Import the new notification bell component

// AdminNavIcon draws a small icon for each admin menu link
function AdminNavIcon({ to }) {                                       // "to" is the link path, used to pick the icon
  const paths = {                                                     // List of icons; the key is the page path
    '/admin/dashboard': (                                             // Icon for Dashboard (a chart)
      <>                                                              {/* Group the shapes without an extra tag */}
        <path d="M4 19V5M4 19h16" />                                  {/* Chart axis lines */}
        <path d="m7 15 3-4 3 2 5-7" />                                {/* Chart line going up */}
      </>
    ),
    '/admin/bookings': (                                              // Icon for Bookings (a calendar)
      <>                                                              {/* Group the shapes without an extra tag */}
        <rect x="4" y="5" width="16" height="15" rx="2" />            {/* Calendar box */}
        <path d="M8 3v4m8-4v4M4 9h16m-11 4h3m-3 3h6" />               {/* Calendar rings and lines */}
      </>
    ),
    '/admin/facilities': (                                            // Icon for Facilities (a building)
      <>                                                              {/* Group the shapes without an extra tag */}
        <path d="M3 20h18M5 20V8l7-4 7 4v12" />                       {/* Building walls and roof */}
        <path d="M9 20v-6h6v6M8 10h.1M12 10h.1M16 10h.1" />           {/* Door and windows */}
      </>
    ),
    '/admin/users': (                                                 // Icon for Users (two people)
      <>                                                              {/* Group the shapes without an extra tag */}
        <circle cx="9" cy="8" r="3" />                                {/* Head of the first person */}
        <path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1Zm11-8a3 3 0 1 0 0-6m1.5 9.5a4.5 4.5 0 0 1 4.5 4.5" />    {/* Bodies and the second person */}
      </>
    ),
    '/admin/maintenance': (                                           // Icon for Maintenance (a wrench)
      <>                                                              {/* Group the shapes without an extra tag */}
        <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3Z" />    {/* Wrench shape */}
        <path d="m4 17 3 3" />                                        {/* Wrench handle end */}
      </>
    ),
    '/admin/tournaments': (                                           // Icon for Tournaments (a trophy)
      <>                                                              {/* Group the shapes without an extra tag */}
        <path d="M8 4h8v4a4 4 0 0 1-8 0Zm4 8v5m-4 3h8m-8-3h8M8 6H5v2a4 4 0 0 0 4 4m7-6h3v2a4 4 0 0 1-4 4" />    {/* Trophy cup, handles and base */}
      </>
    ),
    '/admin/reports': (                                               // Icon for Reports (a bar chart)
      <>                                                              {/* Group the shapes without an extra tag */}
        <path d="M4 19V5m0 14h16" />                                  {/* Chart axis lines */}
        <path d="M7 15v-3m4 3V8m4 7v-5m4 5V6" />                      {/* Chart bars */}
      </>
    ),
    '/admin/settings': (                                              // Icon for Settings (a gear)
      <>                                                              {/* Group the shapes without an extra tag */}
        <circle cx="12" cy="12" r="3" />                              {/* Center circle of the gear */}
        <path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" />    {/* Gear outline with teeth */}
      </>
    ),
  };

  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas (24 x 24); hidden from screen readers */}
      {paths[to] || (                                                 // Use the icon for this path, or the default icon below
        <>                                                            {/* Group the default shapes */}
          <circle cx="12" cy="12" r="8" />                            {/* Default circle */}
          <path d="M8 12h8m-4-4v8" />                                 {/* Plus sign inside the circle */}
        </>
      )}
    </svg>
  );
}

// Header is the top bar of the site (logo, menu, user menu, bell)
function Header({ links, homeTo = '/' }) {                            // "links" = admin links (optional); "homeTo" = where the logo goes
  const location = useLocation();                                     // Info about the current page address
  const navigate = useNavigate();                                     // Function to go to another page
  const { user } = useAuth();                                         // The logged-in user (or nothing)
  const [menuOpen, setMenuOpen] = useState(false);                    // Is the mobile menu open?
  const [logoTransition, setLogoTransition] = useState('idle');       // Logo intro screen state: idle, intro, or leaving
  const transitionTimeoutRef = useRef(null);                          // Holds the timer of the logo intro
  const skipTransitionRef = useRef(null);                             // Reference to the "Skip intro" button
  const navRef = useRef(null);                                        // Reference to the main menu (nav)
  const adminTabBarRef = useRef(null);                                // Reference to the admin bottom tab bar
  const isAdminNavigation = Boolean(links);                           // True when admin links were given
  const quickAdminLinks =                                             // The 4 main admin links for the bottom tab bar
    links?.filter(({ to }) =>                                         // Keep only some of the admin links
      ['/admin/dashboard', '/admin/bookings', '/admin/facilities', '/admin/users'].includes(to),    // The 4 allowed paths
    ) || [];                                                          // Use an empty list if there are no links
  const moreAdminLinksActive =                                        // Is the current page one of the "More" links?
    isAdminNavigation && !quickAdminLinks.some(({ to }) => location.pathname.startsWith(to));    // Admin page that is not in the 4 quick links
  useEffect(() => setMenuOpen(false), [location.pathname]);           // Close the mobile menu when the page changes
  useEffect(() => () => window.clearTimeout(transitionTimeoutRef.current), []);    // When the header is removed, stop the logo timer
  useEffect(() => {                                                   // Effect for keyboard control during the logo intro
    if (logoTransition !== 'intro') return undefined;                 // Do nothing unless the intro is showing
    skipTransitionRef.current?.focus();                               // Move focus to the "Skip intro" button
    const handleKeyDown = (event) => {                                // Runs when a key is pressed
      if (event.key === 'Escape') finishLogoTransition();             // Esc key closes the intro
      if (event.key === 'Tab') {                                      // Tab key pressed
        event.preventDefault();                                       // Stop focus from leaving the intro
        skipTransitionRef.current?.focus();                           // Keep focus on the "Skip intro" button
      }
    };
    window.addEventListener('keydown', handleKeyDown);                // Listen for key presses
    return () => window.removeEventListener('keydown', handleKeyDown);    // Cleanup: stop listening
  }, [logoTransition]);                                               // Run again when the intro state changes

  // Close the intro screen, then go to the home page
  const finishLogoTransition = () => {                                // Function that ends the logo intro
    window.clearTimeout(transitionTimeoutRef.current);                // Stop any running timer
    setLogoTransition('leaving');                                     // Start the fade-out animation
    transitionTimeoutRef.current = window.setTimeout(() => {          // Wait for the fade-out to finish
      navigate(homeTo);                                               // Go to the home page
      setLogoTransition('idle');                                      // Reset the intro state
    }, 320);                                                          // Wait 320 milliseconds
  };

  // When the logo is clicked, show the intro screen first
  const handleLogoClick = (event) => {                                // Runs when the logo is clicked
    if (homeTo !== '/' || logoTransition !== 'idle') return;          // Skip if the logo goes elsewhere or the intro is already running
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;    // Skip the intro if the user wants less animation
    event.preventDefault();                                           // Stop the normal link click
    setLogoTransition('intro');                                       // Show the intro screen
    transitionTimeoutRef.current = window.setTimeout(() => {          // After the intro time
      setLogoTransition('leaving');                                   // Start the fade-out animation
      transitionTimeoutRef.current = window.setTimeout(() => {        // Wait for the fade-out to finish
        navigate(homeTo);                                             // Go to the home page
        setLogoTransition('idle');                                    // Reset the intro state
      }, 320);                                                        // Wait 320 milliseconds
    }, 1750);                                                         // Show the intro for 1.75 seconds
  };

  // Keep the mobile bottom tab bar above the footer (main menu)
  useEffect(() => {
    const nav = navRef.current;                                       // Get the menu element
    if (!nav) return undefined;                                       // Stop if there is no menu

    const updateFooterPosition = () => {                              // Work out where the footer is
      if (!window.matchMedia('(max-width: 600px)').matches) {         // If the screen is not a phone
        nav.style.removeProperty('--footer-offset');                  // Remove the footer space setting
        nav.classList.remove('is-footer-past');                       // Remove the "hide at footer" class
        return;                                                       // Stop here
      }

      const footer = document.querySelector('.footer');               // Find the footer on the page
      if (!footer) return;                                            // Stop if there is no footer
      const footerTop = footer.getBoundingClientRect().top;           // Distance from the screen top to the footer
      const footerOffset = Math.max(0, window.innerHeight - footerTop);    // How much of the footer is visible (never below 0)
      nav.style.setProperty('--footer-offset', `${footerOffset}px`);  // Save it so the CSS can lift the tab bar
      nav.classList.toggle('is-footer-past', footerTop <= nav.offsetHeight + 1);    // Hide the bar when the footer reaches it
    };

    const initialUpdate = window.requestAnimationFrame(updateFooterPosition);    // Run once after the first paint
    window.addEventListener('scroll', updateFooterPosition, { passive: true });  // Update when the user scrolls
    window.addEventListener('resize', updateFooterPosition);          // Update when the window size changes
    return () => {                                                    // Cleanup: runs when the header is removed
      window.cancelAnimationFrame(initialUpdate);                     // Cancel the first update if it has not run yet
      window.removeEventListener('scroll', updateFooterPosition);     // Stop listening for scroll
      window.removeEventListener('resize', updateFooterPosition);     // Stop listening for resize
    };
  }, []);                                                             // Empty list: run only once

  // Keep the admin bottom tab bar above the footer (same idea as above)
  useEffect(() => {
    const tabBar = adminTabBarRef.current;                            // Get the admin tab bar element
    if (!tabBar) return undefined;                                    // Stop if there is no tab bar

    const updateFooterPosition = () => {                              // Work out where the footer is
      if (!window.matchMedia('(max-width: 600px)').matches) {         // If the screen is not a phone
        tabBar.style.removeProperty('--footer-offset');               // Remove the footer space setting
        tabBar.classList.remove('is-footer-past');                    // Remove the "hide at footer" class
        return;                                                       // Stop here
      }

      const footer = document.querySelector('.admin-dashboard > .footer');    // Find the footer inside the admin page
      if (!footer) return;                                            // Stop if there is no footer
      const footerTop = footer.getBoundingClientRect().top;           // Distance from the screen top to the footer
      const footerOffset = Math.max(0, window.innerHeight - footerTop);    // How much of the footer is visible (never below 0)
      tabBar.style.setProperty('--footer-offset', `${footerOffset}px`);    // Save it so the CSS can lift the tab bar
      tabBar.classList.toggle('is-footer-past', footerTop <= tabBar.offsetHeight + 1);    // Hide the bar when the footer reaches it
    };

    const initialUpdate = window.requestAnimationFrame(updateFooterPosition);    // Run once after the first paint
    window.addEventListener('scroll', updateFooterPosition, { passive: true });  // Update when the user scrolls
    window.addEventListener('resize', updateFooterPosition);          // Update when the window size changes
    return () => {                                                    // Cleanup: runs when the header is removed
      window.cancelAnimationFrame(initialUpdate);                     // Cancel the first update if it has not run yet
      window.removeEventListener('scroll', updateFooterPosition);     // Stop listening for scroll
      window.removeEventListener('resize', updateFooterPosition);     // Stop listening for resize
    };
  }, []);                                                             // Empty list: run only once

  // Helpers that add the "active" class to the link of the current page
  const isActive = (path) => (location.pathname === path ? 'active' : '');    // Exact match: the page address equals the path
  // Custom links (admin) stay highlighted on sub-paths too.
  const isActiveSection = (path) => (location.pathname.startsWith(path) ? 'active' : '');    // Starts-with match: also active on sub-pages

    // ---------- What the header shows on the screen ----------
  return (
    <header className={`header${links ? ' has-custom-nav' : ' has-primary-tabs'}`}>    {/* Header bar; the class changes for admin or normal pages */}
      <Link to={homeTo} className="nav-brand" aria-label="CST-SFBS home" onClick={handleLogoClick}>    {/* Logo link; click starts the intro */}
        <img src="/images/logo.png" alt="CST-SFBS logo" className="nav-logo-img" />    {/* The logo image */}
      </Link>
      {!isAdminNavigation && (                                        // Show the menu button only on normal (non-admin) pages
        <button
          type="button"                                               // Normal button (does not submit a form)
          className={`mobile-menu-button${menuOpen ? ' is-open' : ''}`}    // Add "is-open" when the menu is open
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}    // Text for screen readers
          aria-expanded={menuOpen}                                    // Tell screen readers if the menu is open
          aria-controls="primary-navigation"                          // This button controls the menu with this id
          onClick={() => setMenuOpen((open) => !open)}                // Click: open the menu, or close it if open
        >
          <span />                                                    {/* Top line of the 3-line icon */}
          <span />                                                    {/* Middle line of the 3-line icon */}
          <span />                                                    {/* Bottom line of the 3-line icon */}
        </button>
      )}
      <nav
        ref={navRef}                                                  // Connect this menu to navRef (used for the footer position)
        id="primary-navigation"                                       // Id so the buttons can point to this menu
        aria-label={links ? 'Admin navigation' : undefined}           // Label for screen readers on admin pages
        className={`nav${links ? ' nav-custom' : ''}${menuOpen ? ' is-open' : ''}`}    // Add extra classes for admin and for open menu
      >
        {links ? (                                                    // If admin links were given
          links.map((l) => (                                          // Go through each admin link
            <Link
              key={l.to}                                              // Key so React can track each link
              to={l.to}                                               // The page this link opens
              className={isActiveSection(l.to)}                       // Add "active" for the current section
              aria-current={isActiveSection(l.to) ? 'page' : undefined}    // Tell screen readers it is the current page
            >
              <AdminNavIcon to={l.to} />                              {/* Icon of this admin link */}
              <span>{l.label}</span>                                  {/* Text of this admin link */}
            </Link>
          ))
        ) : (                                                         // Otherwise show the normal links below
          <>                                                          {/* Group the links without an extra tag */}
            <Link to="/" className={isActive('/')}>                   {/* Home link */}
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <path d="m3.6 10.6 8.2-6.9 8.6 6.8M5.7 9.2v10.5c0 .4.3.7.7.7h11.3c.4 0 .7-.3.7-.7V9.2M9.1 20.2v-6.4c0-.4.3-.7.7-.7h4.5c.4 0 .7.3.7.7v6.4" />    {/* House shape */}
              </svg>
              <span>Home</span>                                       {/* Link text */}
            </Link>
            <Link to="/facilities" className={isActive('/facilities')}>    {/* Facilities link */}
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <path d="M4.2 20V9.1L12 4.5l7.8 4.6V20M4.2 20h15.6M8 20v-6.1c0-.5.4-.9.9-.9h6.2c.5 0 .9.4.9.9V20M8 9.4h.1M12 9.4h.1M16 9.4h.1" />    {/* Building shape */}
              </svg>
              <span>Facilities</span>                                 {/* Link text */}
            </Link>
            <Link
              to="/rules"                                             // Page this link opens
              className={isActive('/rules')}                          // Add "active" on this page
              aria-current={isActive('/rules') ? 'page' : undefined}  // Tell screen readers it is the current page
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <path d="M7 3.8h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" />    {/* Paper sheet */}
                <path d="M14.5 4v4.5H19M8.5 12h7m-7 3.5h7" />         {/* Folded corner and text lines */}
              </svg>
              <span>Booking Rules</span>                              {/* Link text */}
            </Link>
            <Link
              to="/fees"                                              // Page this link opens
              className={isActive('/fees')}                           // Add "active" on this page
              aria-current={isActive('/fees') ? 'page' : undefined}   // Tell screen readers it is the current page
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <circle cx="12" cy="12" r="9" />                      {/* Coin circle */}
                <path d="M15.5 8.5c-.7-.7-1.7-1-3-1-1.6 0-2.7.8-2.7 2s1 1.8 2.7 2.3 2.7 1.1 2.7 2.4-1.2 2.2-3 2.2c-1.2 0-2.4-.4-3.2-1.2M12 5.5v13" />    {/* Dollar sign inside the coin */}
              </svg>
              <span>Fee Structure</span>                              {/* Link text */}
            </Link>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>    {/* My Bookings link */}
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <path d="M5.2 5.8h13.6c.8 0 1.4.6 1.4 1.4v11.2c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4V7.2c0-.8.6-1.4 1.4-1.4ZM7.7 3.8v4M16.3 3.8v4M4 10.1h16M7.3 13.8l1.2 1.2 2-2.1M13.5 14h3.2M13.5 17h3.2" />    {/* Calendar with a check mark */}
              </svg>
              <span>My Bookings</span>                                {/* Link text */}
            </Link>
            <Link to="/help" className={isActive('/help')}>           {/* Help link */}
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">    {/* Icon canvas; hidden from screen readers */}
                <path d="M20 11.4a7.8 7.8 0 0 1-8 7.6 8.7 8.7 0 0 1-3.7-.8L4 19.5l1-3.5a7.2 7.2 0 0 1-1.1-3.8A7.8 7.8 0 0 1 12 4.6a7.8 7.8 0 0 1 8 6.8Z" />    {/* Chat bubble */}
                <path d="M9.4 9.5a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.1.8-1.1 1.7M11.5 16.8h.1" />    {/* Question mark inside the bubble */}
              </svg>
              <span>Help &amp; Contact</span>                         {/* Link text */}
            </Link>
          </>
        )}
      </nav>
      {user ? (                                                       // If a user is logged in
        // wrapper keeps the user menu and the bell side by side
        <div className="header-actions">                              {/* Wrapper for the user menu and the bell */}
          <UserMenu />                                                {/* The name and dropdown stay first (left) */}
          {user.role !== 'admin' && <NotificationBell />}             {/* Bell is last (far right); hidden for admin users */}
        </div>
      ) : (                                                           // If nobody is logged in
        <Link to="/login" className="user-pill" style={{ textDecoration: 'none' }}>    {/* "Sign in" pill; no underline */}
          Sign in
        </Link>
      )}
      {isAdminNavigation && (                                         // Show the bottom tab bar only on admin pages
        <nav
          ref={adminTabBarRef}                                        // Connect this bar to adminTabBarRef (used for the footer position)
          className="admin-mobile-tabbar"                             // Style class for the admin bottom bar
          aria-label="Admin quick navigation"                         // Label for screen readers
        >
          {quickAdminLinks.map((link) => {                            // Go through each quick link
            const active = location.pathname.startsWith(link.to);     // Is this the current section?
            return (
              <Link
                key={link.to}                                         // Key so React can track each link
                to={link.to}                                          // The page this link opens
                className={active ? 'active' : ''}                    // Add "active" for the current section
                aria-current={active ? 'page' : undefined}            // Tell screen readers it is the current page
              >
                <AdminNavIcon to={link.to} />                         {/* Icon of this tab */}
                <span>                                                {/* Text of this tab */}
                  {link.key === 'Facilities Status'                   // If the key is "Facilities Status"
                    ? 'Facilities'                                    // Show a shorter word
                    : link.key === 'Users'                            // Else, if the key is "Users"
                      ? 'Users'                                       // Show "Users"
                      : link.key}                                     {/* Otherwise show the key as it is */}
                </span>
              </Link>
            );
          })}
          <button
            type="button"                                             // Normal button (does not submit a form)
            className={moreAdminLinksActive ? 'active' : ''}          // Add "active" when the page is one of the "More" links
            aria-expanded={menuOpen}                                  // Tell screen readers if the menu is open
            aria-controls="primary-navigation"                        // This button controls the menu with this id
            onClick={() => setMenuOpen((open) => !open)}              // Click: open the menu, or close it if open
          >
            <AdminNavIcon to="/admin/more" />                         {/* Default icon (plus sign) for "More" */}
            <span>More</span>                                         {/* Button text */}
          </button>
        </nav>
      )}
      {logoTransition !== 'idle' && (                                 // Show the intro screen only while it is running
        <div
          className={`logo-home-transition${logoTransition === 'leaving' ? ' is-leaving' : ''}`}    // Add "is-leaving" for the fade-out
          role="dialog"                                               // Tell screen readers this is a pop-up screen
          aria-modal="true"                                           // The page behind it is not usable now
          aria-labelledby="logo-transition-title"                     // The title below names this screen
        >
          <div className="logo-transition-content">                   {/* Wrapper for the logo and texts */}
            <span className="logo-transition-orbit" aria-hidden="true" />    {/* Thin circle behind the logo; hidden from screen readers */}
            <img className="logo-transition-mark" src="/images/logo.png" alt="" />    {/* Big logo; empty alt because it is decoration */}
            <p className="logo-transition-kicker">College of Science and Technology</p>    {/* Small gold text above the title */}
            <h2 id="logo-transition-title">Every game starts with a place.</h2>    {/* Big title */}
            <p className="logo-transition-caption">                   {/* Small text under the title */}
              Welcome to CST Sports Facilities Booking System
            </p>
          </div>
          <button
            ref={skipTransitionRef}                                   // Connect this button to skipTransitionRef (gets focus)
            className="logo-transition-skip"                          // Style class for the skip button
            type="button"                                             // Normal button (does not submit a form)
            onClick={finishLogoTransition}                            // Click: close the intro and go home
          >
            Skip intro
          </button>
        </div>
      )}
    </header>
  );
}

export default Header;                                                // Export Header so other files can use it
