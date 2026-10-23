const SPORTS = ['Football', 'Basketball', 'Volleyball', 'Badminton', 'Table tennis', 'Archery'];

function AuthLayout({ tagline, headline, chips, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <div className="auth-side-top">
          <img
            className="auth-logo"
            src="/images/logo.png"
            alt="College of Science & Technology: Sport Facility Booking System"
          />
          {!headline && <p>{tagline}</p>}
        </div>

        {headline && (
          <div className="auth-hero">
            <h1>{headline}</h1>
            <p>{tagline}</p>
            {chips && (
              <ul className="auth-chips">
                {chips.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

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

export { SPORTS };
export default AuthLayout;