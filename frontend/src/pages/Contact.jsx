// =============================================================
// frontend/src/pages/Contact.jsx  —  Help & Contact  (owner: Samdrup, stretch)
// =============================================================
// Route:  /help
// There is no mail server behind this project, so the "Send a message"
// button opens the visitor's own email app (mailto:) instead of pretending
// to send something. That keeps the page honest.
import { useState } from 'react';
import './Contact.css';

const DSA_EMAIL = 'kelzangdorji.cst@rub.edu.bt';
const STEPS = [
  { title: 'Browse facilities', text: 'Open Facilities and choose a sport.' },
  { title: 'Check availability', text: 'Pick a date and see which slots are free.' },
  { title: 'Book a slot', text: 'Confirm your details and agree to the rules.' },
  { title: 'Get confirmation', text: 'Your booking is confirmed instantly. Carry your ID card.' },
];

function Contact() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  function openEmail(e) {
    e.preventDefault();
    const subject = encodeURIComponent('CST-SFBS question');
    const body = encodeURIComponent(`${message}\n\n${name}`);
    window.location.href = `mailto:${DSA_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <main className="main">
      <h1 className="title">Help &amp; Contact</h1>
      <p className="subtitle">CST-SFBS is the booking system for the sports facilities of the College of Science and Technology.</p>

      <h2 className="section-title">How it works</h2>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div className="step" key={s.title}>
            <div className="step-number">{i + 1}</div>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title">Contact the DSA office</h2>
      <div className="contact-grid">
        <div className="contact-card">
          <div><strong>Office of the Dean of Student Affairs</strong></div>
          <p>Email: {DSA_EMAIL}</p>
          <p>Phone: 17666628</p>
          <p>Phuentsholing, Chhukha, Bhutan</p>
        </div>
        <form className="contact-card" onSubmit={openEmail}>
          <label className="contact-field">Your name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="contact-field">Your question<textarea value={message} onChange={(e) => setMessage(e.target.value)} required /></label>
          <button className="btn-primary" type="submit">Open in my email app</button>
        </form>
      </div>
    </main>
  );
}

export default Contact;