// ==================== IMPORTS ====================
import { useState, useEffect, useRef } from 'react';     // React tools we need
import { Link, useNavigate } from 'react-router-dom';    // Links and page jumping
import { useAuth } from '../AuthContext';                // Gives us user and logout
import './UserMenu.css';                                 // Styles for this menu

// ==================== HELPERS ====================
// Makes "tshering euden" become "Tshering Euden"
const titleCase = (s = '') => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());    // Make each word start with a capital letter

// Shared settings for every small svg icon
const icon = {                  // Object with the shared icon settings
  width: 18,                    // Icon width
  height: 18,                   // Icon height
  viewBox: '0 0 24 24',         // Drawing area
  fill: 'none',                 // No fill color
  stroke: 'currentColor',       // Line uses text color
  strokeWidth: 2,               // Line thickness
  strokeLinecap: 'round',       // Round line ends
  strokeLinejoin: 'round',      // Round corners
  'aria-hidden': true,          // Hide icon from screen readers
};                              // End of the icon settings

// ==================== COMPONENT ====================
// The account menu: a pill button that opens a dropdown panel
function UserMenu() {    // Component with no props
  // ---------- State and refs ----------
  const { user, logout } = useAuth();             // Logged in user and logout function
  const [open, setOpen] = useState(false);        // Is the dropdown open?
  const ref = useRef(null);                       // Points to the whole menu
  const btnRef = useRef(null);                    // Points to the pill button
  const navigate = useNavigate();                 // Used to change page

  // ---------- Close on outside click or Escape ----------
  // Runs once: adds the listeners, and removes them when the menu goes away
  useEffect(() => {                                          // Run this code once after the first render
    // Closes the menu when the user clicks outside of it
    const onClick = (e) => {                                 // Function that runs on every mouse click
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);    // If the click was outside the menu, close it
    };                                                       // End of onClick
    // Closes the menu when the Escape key is pressed
    const onKey = (e) => {                                   // Function that runs on every key press
      if (e.key === 'Escape') {                              // Check if the key is Escape
        setOpen(false);                                      // Close the menu
        btnRef.current?.focus();                             // Put focus back on the button
      }                                                      // End of the Escape check
    };                                                       // End of onKey
    document.addEventListener('mousedown', onClick);         // Start listening to clicks
    document.addEventListener('keydown', onKey);             // Start listening to keys
    return () => {                                           // Cleanup function, runs when the menu goes away
      document.removeEventListener('mousedown', onClick);    // Stop listening to clicks
      document.removeEventListener('keydown', onKey);        // Stop listening to keys too
    };                                                       // End of the cleanup function
  }, []);                                                    // Empty list means: run only once

  // Show nothing when nobody is logged in
  if (!user) return null;    // No user, so draw nothing

  // ---------- Actions ----------
  // Logs the user out and sends them to the right page
  const handleLogout = () => {                               // Function for the logout button
    setOpen(false);                                          // Close the menu first
    logout();                                                // Clear the login
    navigate(user.role === 'admin' ? '/login' : '/');        // Admin goes to login, others to home
  };                                                         // End of handleLogout

  // ---------- Display values ----------
  const isAdmin = user.role === 'admin';                        // True when the user is an admin
  const name = titleCase(user.full_name ?? user.name ?? '');    // Nice looking name
  const role = titleCase(user.role || 'Student');               // Nice looking role
  const initials = name                                         // Start from the nice name
    .split(/\s+/)                                               // Split name into words
    .filter(Boolean)                                            // Remove empty parts
    .slice(0, 2)                                                // Keep first two words
    .map((part) => part[0])                                     // Take the first letter of each
    .join('')                                                   // Join the letters
    .toUpperCase();                                             // Make them capital

  // ==================== PAGE OUTPUT ====================
  return (                                     // Start of the JSX to show
    <div className="user-menu" ref={ref}>      {/* Main box; ref lets us detect outside clicks */}
      {/* ===== Pill button ===== */}
      <button                                                          // Start of the button tag
        ref={btnRef}                                                   // Save this button in btnRef
        type="button"                                                  // Not a submit button
        className="user-menu-btn"                                      // Style name
        onClick={() => setOpen((o) => !o)}                             // Click flips open and closed
        aria-haspopup="menu"                                           // Tells screen readers it opens a menu
        aria-expanded={open}                                           // Tells screen readers if it is open
      >                                                                {/* End of the button start tag */}
        <svg {...icon}>                                                {/* Start of the user icon, uses shared settings */}
          <circle cx="12" cy="12" r="10" />                            {/* Big outer circle */}
          <circle cx="12" cy="10" r="3" />                             {/* Small circle for the head */}
          <path d="M6.17 18.9a7 7 0 0 1 11.66 0" />                    {/* Curve for the shoulders */}
        </svg>                                                         {/* End of the user icon */}
        <span className="user-menu-btn-avatar" aria-hidden="true">     {/* Start of the initials box, hidden from screen readers */}
          {initials}                                                   {/* Show the initials */}
        </span>                                                        {/* End of the initials box */}
        <span className="user-menu-btn-name">{name}</span>             {/* Show the user name */}
        <svg {...icon} width="16" height="16" className={`user-menu-chevron ${open ? 'open' : ''}`}>    {/* Arrow icon; smaller, and gets "open" class when open */}
          <path d="m6 9 6 6 6-6" />                                    {/* Arrow shape pointing down */}
        </svg>                                                         {/* End of the arrow icon */}
      </button>                                                        {/* End of the button */}

      {/* ===== Dropdown panel ===== */}
      {open && (                                                 // Show the panel only when open is true
        <div className="user-menu-panel" role="menu">            {/* Panel box; role tells screen readers it is a menu */}
          {/* ===== Header with name and role ===== */}
          <div className="user-menu-head">                       {/* Top part of the panel */}
            <div className="user-menu-avatar">                   {/* Round box for the user icon */}
              <svg {...icon} width="22" height="22">             {/* Start of the bigger user icon */}
                <circle cx="12" cy="8" r="4" />                  {/* Circle for the head */}
                <path d="M4 21a8 8 0 0 1 16 0" />                {/* Curve for the body */}
              </svg>                                             {/* End of the user icon */}
            </div>                                               {/* End of the round box */}
            <div className="user-menu-who">                      {/* Box for the name and role */}
              <div className="user-menu-name">{name}</div>       {/* Show the name */}
              <div className="user-menu-role">{role}</div>       {/* Show the role */}
            </div>                                               {/* End of the name and role box */}
            <svg {...icon} width="16" height="16" className="user-menu-check">    {/* Start of the small check icon */}
              <path d="M20 6 9 17l-5-5" />                       {/* Check mark shape */}
            </svg>                                               {/* End of the check icon */}
          </div>                                                 {/* End of the header */}

          <div className="user-menu-divider" />    {/* Thin line between sections */}

          {/* ===== Student links (hidden for admin) ===== */}
          {!isAdmin && (                                 // Show these links only when the user is not an admin
            <>                                           {/* Fragment: groups items without an extra box */}
              <Link                                      // Start of the Profile link
                to="/settings"                           // Page to open
                role="menuitem"                          // Menu item for screen readers
                className="user-menu-item"               // Style name
                onClick={() => setOpen(false)}           // Close the menu after click
              >                   {/* End of the link start tag */}
                <svg {...icon}>                                          {/* Start of the profile icon */}
                  <circle cx="12" cy="8" r="4" />                        {/* Circle for the head */}
                  <path d="M4 21a8 8 0 0 1 16 0" />                      {/* Curve for the body */}
                </svg>                                                   {/* End of the profile icon */}
                Profile &amp; Settings                                   {/* Link text */}
              </Link>                                                    {/* End of the Profile link */}
              <Link                                                      // Start of the Bookings link
                to="/my-bookings"                  // Page to open
                role="menuitem"                    // Menu item for screen readers
                className="user-menu-item"         // Style name
                onClick={() => setOpen(false)}     // Close the menu after click
              >                             {/* End of the link start tag */}
                <svg {...icon}>             {/* Start of the calendar icon */}
                  <rect x="3" y="4" width="18" height="18" rx="2" />     {/* Calendar box with round corners */}
                  <path d="M16 2v4M8 2v4M3 10h18" />                     {/* Two rings on top and a line below */}
                </svg>                             {/* End of the calendar icon */}
                My Bookings                        {/* Link text */}
              </Link>                              {/* End of the Bookings link */}
              <div className="user-menu-divider" />                      {/* Thin line after the student links */}
            </>              // End of the fragment
          )}                 {/* End of the student links */}

          {/* ===== Admin links (shown for admin only) ===== */}
          {isAdmin && (                       // Show these links only when the user is an admin
            <>                                {/* Fragment: groups items without an extra box */}
              <Link                           // Start of the Settings link
                to="/admin/settings"                      // Page to open
                role="menuitem"                           // Menu item for screen readers
                className="user-menu-item"                // Style name
                onClick={() => setOpen(false)}            // Close the menu after click
              >                                                       {/* End of the link start tag */}
                <svg {...icon}>                                       {/* Start of the gear icon */}
                  <circle cx="12" cy="12" r="3" />                    {/* Small circle in the middle of the gear */}
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />    {/* Outline of the gear (teeth and edge) */}
                </svg>                                                {/* End of the gear icon */}
                System Settings                                       {/* Link text */}
              </Link>                                                 {/* End of the Settings link */}
              <Link                                                   // Start of the Reports link
                to="/admin/reports"                                   // Page to open
                role="menuitem"                                       // Menu item for screen readers
                className="user-menu-item"                            // Style name
                onClick={() => setOpen(false)}                        // Close the menu after click
              >                                                       {/* End of the link start tag */}
                <svg {...icon}>                                       {/* Start of the chart icon */}
                  <path d="M3 3v18h18" />                             {/* Left and bottom axis lines */}
                  <path d="M18 17V9M13 17V5M8 17v-3" />               {/* Three bars of the chart */}
                </svg>                                                {/* End of the chart icon */}
                Reports &amp; Analytics                               {/* Link text */}
              </Link>                                                 {/* End of the Reports link */}
              <Link                                                   // Start of the Support link
                to="/admin/support"                                   // Page to open
                role="menuitem"                                       // Menu item for screen readers
                className="user-menu-item"                            // Style name
                onClick={() => setOpen(false)}                        // Close the menu after click
              >                                                       {/* End of the link start tag */}
                <svg {...icon}>                                       {/* Start of the message icon */}
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />    {/* Speech bubble shape */}
                </svg>                                                {/* End of the message icon */}
                Support Requests                                      {/* Link text */}
              </Link>                                                 {/* End of the Support link */}
              <div className="user-menu-divider" />                   {/* Thin line after the admin links */}
            </>                                                       // End of the fragment
          )}                                                          {/* End of the admin links */}

          {/* ===== Logout button ===== */}
          <button                                                     // Start of the Logout button
            type="button"                                             // Not a submit button
            role="menuitem"                                           // Menu item for screen readers
            className="user-menu-item user-menu-logout"               // Two style names: menu item and red logout
            onClick={handleLogout}                                    // Run handleLogout on click
          >                                                           {/* End of the button start tag */}
            <svg {...icon}>                                           {/* Start of the logout icon */}
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />    {/* Door shape with an arrow going out */}
            </svg>                                                    {/* End of the logout icon */}
            Logout                                                    {/* Button text */}
          </button>                                                   {/* End of the Logout button */}
        </div>                                                        // End of the dropdown panel
      )}                                                              {/* End of the open check */}
    </div>                                                            // End of the main box
  );                                                                  // End of the JSX
}                                                                     // End of UserMenu

// ==================== EXPORT ====================
export default UserMenu;    // Lets other files import this menu