import { Link } from 'react-router-dom';                          // Import Link to move between pages without reloading

// Footer shows the bottom part of every page (about, links, contact)
function Footer({ links, heading = 'Your next game' }) {          // "links" can replace the default menu; "heading" is the title above the links
  return (
    <footer className="footer">                                   {/* Footer wrapper of the whole bottom section */}
      <div className="footer-main">                               {/* Main part of the footer with three columns */}
        <div className="footer-about">                            {/* First column: about the system */}
          <div className="footer-brand">                          {/* Logo and name row */}
            <div className="footer-brand-mark">C</div>            {/* Small square logo with the letter C */}
            <div>                                                 {/* Wrapper for the two name lines */}
              <strong>CST-SFBS</strong>                           {/* Short name of the system */}
              <span>College of Science and Technology</span>      {/* Full college name */}
            </div>
          </div>
          <h3>CST Sports Facility Booking System</h3>             {/* Full name of the system */}
          <p>                                                     {/* Short description (text below is shown as it is) */}
            The home of campus sport. Sports facility scheduling for students, staff, and general
            patrons of the College of Science and Technology, Bhutan.
          </p>
        </div>

        <nav className="footer-col" aria-label="Footer navigation">    {/* Second column: links; label helps screen readers */}
          <h4>{heading}</h4>                                      {/* Title above the links (from the heading prop) */}
          {(                                                      // Start of the links list
            links || [                                            // Use the given links, or else the default ones below
              { to: '/facilities', label: 'Browse Facilities' },  // Link to the facilities page
              { to: '/my-bookings', label: 'My Bookings' },       // Link to the user's bookings page
              { to: '/rules', label: 'Booking rules' },           // Link to the booking rules page
              { to: '/fees', label: 'Fee structure' },            // Link to the fees page
              { to: '/help', label: 'Help & contact' },           // Link to the help page
            ]
          ).map((l) => (                                          // Go through each link in the list
            <Link key={l.to} to={l.to}>                           {/* One link; key helps React track it, "to" is the page path */}
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="footer-col footer-contact">               {/* Third column: contact details */}
          <h4>Contact &amp; Info</h4>                             {/* Title of the contact column */}
          <p>Phuentsholing, Chhukha, Bhutan</p>                   {/* Address of the college */}
          <a href="mailto:dsa.cst@rub.edu.bt">kelzangdorji.cst@rub.edu.bt</a>    {/* Email link for the first contact person */}
          <a href="tel:+97517666628">+975-17666628</a>            {/* Phone link for the first contact person */}
          <a href="mailto:sso.cst@rub.edu.bt">Purna Bdr. Mongar</a>              {/* Email link for the second contact person */}
          <a href="tel:+97517362124">+975-17362124</a>            {/* Phone link for the second contact person */}
        </div>
      </div>
      <div className="footer-bottom">                             {/* Bottom strip of the footer */}
        <span>© 2026 College of Science and Technology. All Rights Reserved.</span>    {/* Copyright text */}
      </div>
    </footer>
  );
}

export default Footer;                                            // Export Footer so other files can use it