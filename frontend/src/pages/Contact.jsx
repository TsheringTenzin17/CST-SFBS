// Help & Contact form. Requests are stored by the backend and receive a ticket ID;
// this flow does not send email, so the confirmation says the request is recorded.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import './Contact.css';

export const DSA_EMAIL = 'kelzangdorji.cst@rub.edu.bt';
const STEPS = [
  { title: 'Browse Facilities', text: 'Explore our list of athletic courts, football grounds, traditional archery ranges, and indoor table tennis halls.' },
  { title: 'Check Availability', text: 'Select a preferred date and view live time slots. See real-time availability based on student and faculty schedules.' },
  { title: 'Book a Slot', text: 'Input your Student/Staff ID, select your role, accept university athletic regulations, and lock your slot.' },
  { title: 'Get Confirmation', text: 'Receive a confirmation receipt and check-in guide. Present your physical ID card to safety and security on arrival.' },
];

const OFFICE_DETAILS = [
  { label: 'Office', value: 'Office of the Dean of Student Affairs' },
  { label: 'Email Support', value: DSA_EMAIL, href: `mailto:${DSA_EMAIL}` },
  { label: 'Contact Hotline', value: '17666628', href: 'tel:17666628' },
  { label: 'Address', value: 'Phuentsholing, Chhukha, Bhutan' },
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
    <main className="main contact-page">
      <section className="contact-about">
        <h1>About CST-SFBS</h1>
        <p>
          The College of Science and Technology Sports Facility Booking System (CST-SFBS) is a state-of-the-art
          administrative portal designed to coordinate athletic scheduling, recreational court assignments, and
          tournament rules. Managed under the Dean of Student Affairs (DSA), the system services students, academic
          staff, and registered commercial partners in Phuentsholing, Chhukha, Bhutan.
        </p>
      </section>

      <h2 className="section-title">How It Works</h2>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div className="step" key={s.title}>
            <div className="step-number">{i + 1}</div>
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </div>
        ))}
      </div>

      <h2 className="section-title section-title-lg">Contact &amp; Support</h2>
      <div className="contact-grid">
        <div className="contact-info">
          <h3>DSA Office Coordinates</h3>
          <dl>
            {OFFICE_DETAILS.map((d) => (
              <div className="contact-info-row" key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.href ? <a href={d.href}>{d.value}</a> : d.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <form className="contact-form" onSubmit={submitRequest}>
          <h3>Send us a Message</h3>
          {error && <p className="contact-error" role="alert">{error}</p>}
          <div className="contact-form-row">
            <label className="contact-field">
              Your Name
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="contact-field">
              Your Email
              <input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          </div>
          <label className="contact-field">
            Message / Query
            <textarea
              value={message}
              maxLength={3000}
              placeholder="How can we help you?"
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </label>
          <p className="contact-hint">We’ll save your request and show a ticket number for follow-up.</p>
          <button className="contact-submit" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit Message'}
          </button>
        </form>
      </div>
    </main>
  );
}

export default Contact;