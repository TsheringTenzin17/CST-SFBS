function AuthLayout({ tagline, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <div>
          <h2>College of Science &amp; Technology</h2>
          <p>{tagline}</p>
        </div>
        <div className="auth-side-footer">
          <div>Royal University of Bhutan</div>
          <div>CST-SFBS: Sport Facility Booking System</div>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}

export default AuthLayout;