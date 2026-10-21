import { Link, useLocation } from 'react-router-dom';
import { DSA_EMAIL } from './Contact';
import './ContactConfirmation.css';

function ContactConfirmation() {
  const { state } = useLocation();
  const ticket = state?.ticket;

  if (!ticket?.ticket_id) {
    return (
      <main className="main contact-confirm-page">
        <p>No submitted request to show. <Link to="/help">Contact the DSA office</Link>.</p>
      </main>
    );
  }

  return (
    <main className="main contact-confirm-page">
      <section className="contact-confirm-card" aria-labelledby="contact-confirm-title">
        <div className="contact-confirm-icon" aria-hidden="true">✓</div>
        <h1 id="contact-confirm-title">Message Submitted Successfully</h1>
        <p className="contact-confirm-lead">
          Your request has been saved for the Office of the Dean of Student Affairs to review.
        </p>

        <dl className="contact-ticket-details">
          <div><dt>Ticket ID</dt><dd>{ticket.ticket_id}</dd></div>
          <div><dt>Response email</dt><dd>{ticket.response_email}</dd></div>
          <div><dt>Status</dt><dd><span className="contact-ticket-status">Pending review</span></dd></div>
        </dl>

        <div className="contact-next-steps">
          <h2>What happens next?</h2>
          <p>Your request is recorded in the system. Email <a href={`mailto:${DSA_EMAIL}`}>{DSA_EMAIL}</a> directly if you need to follow up.</p>
          <p>A confirmation email is not sent on submission. The DSA office can email you when your ticket is resolved.</p>
        </div>

        <div className="contact-confirm-actions">
          <Link to="/help" className="btn-secondary">Back to Help &amp; Contact</Link>
          <Link to="/" className="btn-primary btn-link">Return Home</Link>
        </div>
      </section>
    </main>
  );
}

export default ContactConfirmation;
