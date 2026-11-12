import { useEffect, useState } from 'react';                // Import useEffect (run code) and useState (store values)
import { Link } from 'react-router-dom';                    // Import Link to move between pages without reloading
import { useAuth } from '../AuthContext';                   // Import the helper that tells who is logged in
import { apiCall } from '../utils/api';                     // Import the helper that talks to the server
import './LiveNotice.css';                                  // Import the styles for the notice strip

// Decide which kind a notice is, from its type text
function noticeKind(type = '') {                                                       // "type" is the notice type (empty text if missing)
  if (type.includes('maintenance')) return 'maintenance';                              // Type has "maintenance": it is a maintenance notice
  if (type.includes('facility')) return 'facility';                                    // Type has "facility": it is a facility notice
  if (type.includes('announcement') || type.includes('system')) return 'announcement'; // Type has "announcement" or "system": it is an announcement
  return 'announcement';                                                               // Anything else is also an announcement
}

// LiveNotice shows the moving notice strip under the header
export default function LiveNotice() {
  const { user } = useAuth();                               // The logged-in user (or nothing)
  const [notices, setNotices] = useState([]);               // The list of notices from the server
  const [paused, setPaused] = useState(false);              // Is the moving text paused?
  const [dismissed, setDismissed] = useState(false);        // Did the user close the strip?

  // ---------- Load the notices from the server ----------
  useEffect(() => {
    if (!user || user.role === 'admin') return undefined;   // No notices for guests and admins

    let active = true;                                      // Becomes false when the strip is removed (to ignore late results)
    const loadNotices = async () => {                       // Function that asks the server for notices
      try {
        const notifications = await apiCall('/notifications');    // Get the notifications from the server
        if (!active) return;                                // Stop if the strip was already removed
        setNotices(notifications.filter((item) => item && item.message).slice(0, 8));    // Keep only notices with a message, max 8
      } catch {
        // The ticker is non-essential and must not interrupt the rest of the page.
      }
    };

    loadNotices();                                          // Load the notices once at the start
    const refresh = window.setInterval(loadNotices, 30000); // Load them again every 30 seconds
    return () => {                                          // Cleanup: runs when the strip is removed
      active = false;                                       // Ignore any late results
      window.clearInterval(refresh);                        // Stop the 30-second timer
    };
  }, [user]);                                               // Run again when the user changes (login or logout)

  // Show nothing for guests, admins, a closed strip, or when there are no notices
  if (!user || user.role === 'admin' || dismissed || notices.length === 0) return null;

  const combinedText = notices.map((notice) => notice.message).join('      •      ');    // All messages in one text, for screen readers

  // ---------- What the strip shows on the screen ----------
  return (
    <aside className="live-notice" aria-label="Live campus notices">    {/* The whole strip; label helps screen readers */}
      <div className="live-notice-label">                               {/* Label at the start of the strip */}
        <span aria-hidden="true" className="live-notice-dot" />         {/* Blinking dot; hidden from screen readers */}
        Live notice
      </div>
      <div className={`live-notice-track${paused ? ' paused' : ''}`}>   {/* Window where the text moves; "paused" stops it */}
        <div className="live-notice-content">                           {/* The long moving line */}
          {[0, 1].map((group) => (                                      // Make 2 copies so the text loops without a gap
            <div className="live-notice-group" key={group} aria-hidden={group === 1}>    {/* One copy; the 2nd copy is hidden from screen readers */}
              {notices.map((notice, index) => (                         // Go through each notice
                <span key={notice.id || `${notice.type}-${index}`}>     {/* One notice; key helps React track it */}
                  <strong>                                              {/* Bold word before the message */}
                    {noticeKind(notice.type) === 'maintenance'          // Is it a maintenance notice?
                      ? 'Maintenance:'                                  // Yes: show "Maintenance:"
                      : noticeKind(notice.type) === 'facility'          // Else, is it a facility notice?
                        ? 'Facility status:'                            // Yes: show "Facility status:"
                        : 'Announcement:'}                              {/* Otherwise show "Announcement:" */}
                  </strong>{' '}                                         {/* Bold word, then a space */}
                  {notice.message}                                      {/* The notice message */}
                  <i aria-hidden="true">◆</i>                           {/* Small diamond between notices; hidden from screen readers */}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        className="live-notice-control"                                 // Style class for the pause button
        type="button"                                                   // Normal button (does not submit a form)
        aria-label={paused ? 'Resume notice' : 'Pause notice'}          // Text for screen readers
        title={paused ? 'Resume notice' : 'Pause notice'}               // Tip shown when the mouse is over it
        onClick={() => setPaused((current) => !current)}                // Click: switch between paused and playing
      >
        {paused ? '▶' : 'Ⅱ'}                                            {/* Show play when paused, pause when playing */}
      </button>
      <Link className="live-notice-details" to="/notifications">        {/* "Details" button that opens the notifications page */}
        Details
      </Link>
      <button
        className="live-notice-close"                                   // Style class for the close button
        type="button"                                                   // Normal button (does not submit a form)
        aria-label="Dismiss notices"                                    // Text for screen readers
        onClick={() => setDismissed(true)}                              // Click: close the strip
      >
        ×
      </button>
      <span className="sr-only">{combinedText}</span>                   {/* All notices as hidden text, only for screen readers */}
    </aside>
  );
}