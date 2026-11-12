import { useEffect, useRef } from 'react';    // Import useEffect (run code) and useRef (hold an element)
import '../auth.css';                         // Import the styles for the login/register pages

// Default list of sports shown as small chips on the left side
const SPORTS = ['Football', 'Basketball', 'Volleyball', 'Badminton', 'Table tennis', 'Archery'];

// Default big title, split into two lines
const DEFAULT_HEADLINE = ['Book your court.', 'Play your game.'];
// Default short text shown under the title
const DEFAULT_TAGLINE =
  'Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts.';

// AuthLayout is the shared page frame for login/register pages
function AuthLayout({
  tagline = DEFAULT_TAGLINE,      // Use the default tagline if none is given
  headline = DEFAULT_HEADLINE,    // Use the default headline if none is given
  chips = SPORTS,                 // Use the default sports list if none is given
  children,                       // The form (login/register) that goes inside the card
}) {
  const cardRef = useRef(null);    // Reference to the card, so we can tilt it
  const netRef = useRef(null);     // Reference to the canvas, so we can draw dots and lines

  // ---------- Effect 1: floating dots + lines that react to the mouse ----------
  useEffect(() => {
    const canvas = netRef.current;    // Get the canvas element
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;    // Does the user want less animation?
    if (!canvas || reducedMotion) return;    // Stop if there is no canvas or animation is not wanted
    const ctx = canvas.getContext('2d');     // Get the 2D drawing tool of the canvas
    const mouse = { x: -999, y: -999 };      // Mouse position; starts far off-screen
    let W,              // W = canvas width
      H,                // H = canvas height
      pts = [],         // pts = the list of moving dots
      raf;              // raf = id of the animation frame (used to stop it later)
    const lowPowerDevice =                                  // Check if this is a phone/tablet (weaker device)
      window.matchMedia('(max-width: 760px)').matches ||    // True if the screen is narrow
      window.matchMedia('(pointer: coarse)').matches;       // True if the main input is touch

    // Set the canvas size and create the dots
    function size() {
      W = canvas.width = window.innerWidth;      // Make canvas as wide as the window
      H = canvas.height = window.innerHeight;    // Make canvas as tall as the window
      const count = lowPowerDevice               // Decide how many dots to make
        ? Math.min(32, Math.floor(W / 34))       // Phones: fewer dots (max 32)
        : Math.min(70, Math.floor(W / 20));      // Desktop: more dots (max 70)
      pts = Array.from({ length: count }, () => ({    // Create the dots
        x: Math.random() * W,                         // Random start position (left to right)
        y: Math.random() * H,                         // Random start position (top to bottom)
        vx: (Math.random() - 0.5) * 0.4,              // Random slow speed sideways
        vy: (Math.random() - 0.5) * 0.4,              // Random slow speed up/down
      }));
    }

    // Save the mouse position when the mouse moves
    function onMove(e) {
      mouse.x = e.clientX;    // Save mouse left-right position
      mouse.y = e.clientY;    // Save mouse top-bottom position
    }

    // Draw one frame, then ask the browser to draw the next one
    function loop() {
      ctx.clearRect(0, 0, W, H);       // Clear the old drawing
      pts.forEach((p, i) => {          // Go through every dot
        p.x += p.vx;                                   // Move the dot sideways
        p.y += p.vy;                                   // Move the dot up/down
        if (p.x < 0 || p.x > W) p.vx *= -1;            // Bounce back at the left or right edge
        if (p.y < 0 || p.y > H) p.vy *= -1;            // Bounce back at the top or bottom edge
        ctx.fillStyle = 'rgba(124,240,201,.7)';        // Set the dot color (light green)
        ctx.beginPath();                               // Start a new shape
        ctx.arc(p.x, p.y, 1.6, 0, 6.28);               // Make a small circle (6.28 is about a full circle)
        ctx.fill();                                    // Fill the circle with color
        for (let j = i + 1; j < pts.length; j++) {    // Compare this dot with all the dots after it
          const q = pts[j];                              // The other dot
          const d = Math.hypot(p.x - q.x, p.y - q.y);    // Distance between the two dots
          if (d < 130) {    // If they are close enough
            ctx.strokeStyle = `rgba(124,240,201,${0.18 * (1 - d / 130)})`;    // Line color; closer dots get a stronger line
            ctx.beginPath();         // Start a new line
            ctx.moveTo(p.x, p.y);    // Line starts at the first dot
            ctx.lineTo(q.x, q.y);    // Line ends at the second dot
            ctx.stroke();            // Draw the line
          }
        }
        const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);    // Distance between this dot and the mouse
        if (md < 160) {    // If the mouse is close enough
          ctx.strokeStyle = `rgba(79,216,255,${0.5 * (1 - md / 160)})`;    // Blue line; closer mouse gives a stronger line
          ctx.beginPath();                 // Start a new line
          ctx.moveTo(p.x, p.y);            // Line starts at the dot
          ctx.lineTo(mouse.x, mouse.y);    // Line ends at the mouse
          ctx.stroke();                    // Draw the line
        }
      });
      raf = requestAnimationFrame(loop);    // Call loop again on the next frame (keeps animating)
    }

    size();                                          // Set up the canvas and dots first
    loop();                                          // Start the animation
    window.addEventListener('resize', size);         // Rebuild the canvas when the window size changes
    window.addEventListener('mousemove', onMove);    // Track the mouse
    return () => {                                   // Cleanup: runs when the component is removed
      cancelAnimationFrame(raf);                         // Stop the animation
      window.removeEventListener('resize', size);        // Stop listening for resize
      window.removeEventListener('mousemove', onMove);   // Stop listening for mouse move
    };
  }, []);    // Empty list means: run this effect only once

  // ---------- Effect 2: card tilts slightly towards the mouse (desktop only) ----------
  useEffect(() => {
    const card = cardRef.current;    // Get the card element
    const canHover = window.matchMedia('(hover: hover)').matches;    // Can the device hover (has a mouse)?
    const lowPowerDevice =                                  // Check if this is a phone/tablet
      window.matchMedia('(max-width: 760px)').matches ||    // True if the screen is narrow
      window.matchMedia('(pointer: coarse)').matches;       // True if the main input is touch
    if (!card || !canHover || lowPowerDevice) return;       // Stop if no card, no mouse, or weak device

    // Tilt the card based on where the mouse is
    function onMove(e) {
      const r = card.getBoundingClientRect();                                     // Get the card's size and position
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;         // Mouse distance from card center (sideways)
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;        // Mouse distance from card center (up/down)
      card.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;     // Rotate the card a little (about 12 degrees max)
    }
    document.addEventListener('mousemove', onMove);                    // Listen for mouse movement on the page
    return () => document.removeEventListener('mousemove', onMove);    // Cleanup: stop listening when removed
  }, []);    // Empty list means: run this effect only once

  // ---------- What the component shows on the screen ----------
  return (
    <div className="auth-page">    {/* Main wrapper of the whole page */}
      {/* animated background */}
      <div className="auth-aurora" aria-hidden="true">    {/* Colorful glow background; hidden from screen readers */}
        <i />                                             {/* Glow shape 1 */}
        <i />                                             {/* Glow shape 2 */}
        <i />                                             {/* Glow shape 3 */}
        <i />                                             {/* Glow shape 4 */}
      </div>
      <canvas className="auth-net" ref={netRef} aria-hidden="true" />    {/* Canvas where dots and lines are drawn */}
      <div className="auth-floor-wrap" aria-hidden="true">    {/* Wrapper for the floor effect */}
        <div className="auth-floor" />                        {/* The floor design */}
      </div>
      <div className="auth-grain" aria-hidden="true" />       {/* Light grain texture over the background */}

      {/* left side */}
      <aside className="auth-side">             {/* Left side panel with logo and text */}
        <div className="auth-logo-card">        {/* Box that holds the logo */}
          <img
            className="auth-logo"         // Style class for the logo
            src="/images/logo.png"        // Path of the logo image
            alt="College of Science & Technology: Sport Facility Booking System"    // Text for screen readers
          />
        </div>

        {headline ? (                                  // If a headline exists, show the big hero section
          <div className="auth-hero">                  {/* Hero section wrapper */}
            <h1>                                       {/* Main title */}
              {Array.isArray(headline)                 // Is the headline a list of lines?
                ? headline.map((line, i) => (          // Yes: loop through each line
                    <span className="auth-line" key={i}>    {/* One line of the title */}
                      <span className={i === 1 ? 'auth-grad' : undefined}>{line}</span>    {/* Second line gets the gradient style */}
                    </span>
                  ))
                : headline}                            {/* No: it is plain text, so show it as it is */}
            </h1>
            <p className="auth-lead">{tagline}</p>     {/* Short text under the title */}
            {chips && (                                // Show chips only if a chips list exists
              <ul className="auth-chips">              {/* List of small sport tags */}
                {chips.map((s) => (                    // Loop through each sport
                  <li key={s}>{s}</li>                 // One chip per sport
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="auth-lead">{tagline}</p>    // No headline: show only the tagline
        )}

        <div className="auth-side-footer">                      {/* Small footer text at the bottom left */}
          <div>Royal University of Bhutan</div>                 {/* University name */}
          <div>CST-SFBS: Sport Facility Booking System</div>    {/* System name */}
        </div>
      </aside>

      {/* right side */}
      <section className="auth-main">                           {/* Right side area for the form */}
        <div className="auth-card" ref={cardRef}>               {/* The card that tilts (uses cardRef) */}
          <div className="auth-card-inner">{children}</div>     {/* The login/register form goes here */}
        </div>
      </section>
    </div>
  );
}

export { SPORTS };           // Also export the sports list so other files can use it
export default AuthLayout;   // Export AuthLayout as the main thing of this file