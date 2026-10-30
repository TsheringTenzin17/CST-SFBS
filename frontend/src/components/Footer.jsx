import { Link } from 'react-router-dom';

function Footer({ links, heading = 'Your next game' }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-about">
          <div className="footer-brand">
            <div className="footer-brand-mark">C</div>
            <div>
              <strong>CST-SFBS</strong>
              <span>College of Science and Technology</span>
            </div>
          </div>
          <h3>CST Sports Facility Booking System</h3>
          <p>
            The home of campus sport. Sports facility scheduling for students, staff,
            and general patrons of the College of Science and Technology, Bhutan.
          </p>
        </div>

        <nav className="footer-col" aria-label="Footer navigation">
          <h4>{heading}</h4>
          {(links || [
            { to: '/facilities', label: 'Browse Facilities' },
            { to: '/my-bookings', label: 'My Bookings' },
            { to: '/rules', label: 'Booking rules' },
            { to: '/help', label: 'Help & contact' },
          ]).map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        </nav>

        <div className="footer-col footer-contact">
          <h4>Contact &amp; Info</h4>
          <p>Phuentsholing, Chhukha, Bhutan</p>
          <a href="mailto:dsa.cst@rub.edu.bt">dsa.cst@rub.edu.bt</a>
          <a href="tel:+9755252877">+975-5-252877</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 College of Science and Technology. All Rights Reserved.</span>
        <span>Designed &amp; Maintained by CST</span>
      </div>
    </footer>
  );
}

export default Footer;