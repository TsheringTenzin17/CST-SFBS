// Help & Contact form. Requests are stored by the backend and receive a ticket ID;
// this flow does not send email, so the confirmation says the request is recorded.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import './Contact.css';

export const DSA_EMAIL = 'kelzangdorji.cst@rub.edu.bt';
const STEPS = [
  { title: 'Browse facilities', text: 'Open Facilities and choose a sport.' },
  { title: 'Check availability', text: 'Pick a date and see which slots are free.' },
  { title: 'Book a slot', text: 'Confirm your details and agree to the rules.' },
  { title: 'Get confirmation', text: 'Your booking is confirmed instantly. Carry your ID card.' },
];

function Contact() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitRequest(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await apiCall('/support/requests', 'POST', { name, email, message });
      navigate('/help/confirmation', { state: { ticket } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
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
          <p>Email: <a href={`mailto:${DSA_EMAIL}`}>{DSA_EMAIL}</a></p>
          <p>Phone: 17666628</p>
          <p>Phuentsholing, Chhukha, Bhutan</p>
        </div>
        <form className="contact-card" onSubmit={submitRequest}>
          <h3>Send a message</h3>
          {error && <p className="contact-error" role="alert">{error}</p>}
          <label className="contact-field">
            Your name
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="contact-field">
            Response email
            <input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="contact-field">
            Your question
            <textarea value={message} maxLength={3000} onChange={(e) => setMessage(e.target.value)} required />
          </label>
          <p className="contact-hint">We’ll save your request and show a ticket number for follow-up.</p>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit to DSA'}
          </button>
          <Link className="contact-inbox-link" to={`mailto:${DSA_EMAIL}`}>Or email the DSA office directly</Link>
        </form>
      </div>
    </main>
  );
}

export default Contact;