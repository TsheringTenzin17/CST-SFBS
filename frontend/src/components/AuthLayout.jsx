import { useEffect, useRef } from 'react';
import '../auth.css';

const SPORTS = ['Football', 'Basketball', 'Volleyball', 'Badminton', 'Table tennis', 'Archery'];

const DEFAULT_HEADLINE = ['Book your court.', 'Play your game.'];
const DEFAULT_TAGLINE =
  'Nurturing sporting excellence, teamwork and healthy campus life. Reserve campus facilities in a few taps, without conflicts.';

function AuthLayout({
  tagline = DEFAULT_TAGLINE,
  headline = DEFAULT_HEADLINE,
  chips = SPORTS,
  children,
}) {
  const cardRef = useRef(null);
  const netRef = useRef(null);

  // Floating dots + lines that react to the mouse
  useEffect(() => {
    const canvas = netRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    const mouse = { x: -999, y: -999 };
    let W, H, pts = [], raf;

    function size() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const count = Math.min(70, Math.floor(W / 20));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      }));
    }
    function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.fillStyle = 'rgba(124,240,201,.7)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.28); ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(124,240,201,${0.18 * (1 - d / 130)})`;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (md < 160) {
          ctx.strokeStyle = `rgba(79,216,255,${0.5 * (1 - md / 160)})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      });
      raf = requestAnimationFrame(loop);
    }

    size();
    loop();
    window.addEventListener('resize', size);
    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  // Card tilts slightly towards the mouse (desktop only)
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !window.matchMedia('(hover: hover)').matches) return;
    function onMove(e) {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      card.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
    }
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="auth-page">
      {/* animated background */}
      <div className="auth-aurora" aria-hidden="true"><i /><i /><i /><i /></div>
      <canvas className="auth-net" ref={netRef} aria-hidden="true" />
      <div className="auth-floor-wrap" aria-hidden="true"><div className="auth-floor" /></div>
      <div className="auth-grain" aria-hidden="true" />

      {/* left side */}
      <aside className="auth-side">
        <div className="auth-logo-card">
          <img
            className="auth-logo"
            src="/images/logo.png"
            alt="College of Science & Technology: Sport Facility Booking System"
          />
        </div>

        {headline ? (
          <div className="auth-hero">
            <h1>
              {Array.isArray(headline)
                ? headline.map((line, i) => (
                    <span className="auth-line" key={i}>
                      <span className={i === 1 ? 'auth-grad' : undefined}>{line}</span>
                    </span>
                  ))
                : headline}
            </h1>
            <p className="auth-lead">{tagline}</p>
            {chips && (
              <ul className="auth-chips">
                {chips.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <p className="auth-lead">{tagline}</p>
        )}

        <div className="auth-side-footer">
          <div>Royal University of Bhutan</div>
          <div>CST-SFBS: Sport Facility Booking System</div>
        </div>
      </aside>

      {/* right side */}
      <section className="auth-main">
        <div className="auth-card" ref={cardRef}>
          <div className="auth-card-inner">{children}</div>
        </div>
      </section>
    </div>
  );
}

export { SPORTS };
export default AuthLayout;