// ==============================================================
// NotificationBell.jsx  -  BELL ICON AND NOTIFICATION DROPDOWN
// ==============================================================
import { useCallback, useEffect, useRef, useState } from 'react';  // react tools
import { Link } from 'react-router-dom';                           // link to the full page
import { apiCall } from '../utils/api';                            // helper to call the backend
import './NotificationBell.css';                                   // styles for the bell

const PREVIEW_LIMIT = 5;  // how many notifications show in the panel

// ==============================================================
// ICONS  -  small drawings used inside the panel
// ==============================================================
const ICON = {
  width: 16,                // icon width
  height: 16,               // icon height
  viewBox: '0 0 24 24',     // size of the drawing area
  fill: 'none',             // lines only, no colour inside
  stroke: 'currentColor',   // line colour follows the text
  strokeWidth: 2.2,         // line thickness
  strokeLinecap: 'round',   // round line ends
  strokeLinejoin: 'round',  // round corners
  'aria-hidden': true,      // screen readers skip the icon
};

const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,          // tick mark
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,  // cross mark
  warning: (
    <>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alarm: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9.5V13l2.3 1.5M4.5 5.5L7 3.5M19.5 5.5L17 3.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.1" />
    </>
  ),
};

// ==============================================================
// HELPERS  -  choose icon, title and time text
// ==============================================================
// pick icon and colour by notification type (same as the Notifications page)
function appearance(type = '') {
  if (type.includes('cancel')) return { icon: 'cross', tone: 'cancelled' };           // cancelled booking
  if (type.includes('maintenance')) return { icon: 'warning', tone: 'maintenance' };  // maintenance notice
  if (type.includes('pending')) return { icon: 'clock', tone: 'pending' };            // waiting for approval
  if (type.includes('reminder')) return { icon: 'alarm', tone: 'reminder' };          // reminder
  if (type.includes('rescheduled') || type.includes('approved'))
    return { icon: 'check', tone: 'update' };                                   // changed or approved
  if (type.includes('confirmed')) return { icon: 'check', tone: 'confirmed' };  // confirmed booking
  return { icon: 'info', tone: 'info' };                                        // anything else
}

// readable title for each type saved in the database
const TITLES = {
  booking_confirmed: 'Booking Confirmed',
  booking_pending: 'Booking Pending Approval',
  booking_cancelled: 'Booking Cancelled',
  booking_rescheduled: 'Booking Rescheduled',
  booking_reminder: 'Upcoming Activity Reminder',
  maintenance_scheduled: 'Maintenance Scheduled',
};

// change the server time into text like "5 mins ago"
function timeAgo(timestamp) {
  const created = new Date(timestamp).getTime();                             // date in milliseconds
  if (!Number.isFinite(created)) return '';                                  // broken date, show nothing
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));   // minutes passed
  if (minutes < 1) return 'Just now';                                        // under 1 minute
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;  // under 1 hour
  const hours = Math.floor(minutes / 60);                                    // minutes to hours
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;       // under 1 day
  const days = Math.floor(hours / 24);                                       // hours to days
  if (days === 1) return 'Yesterday';                                        // exactly 1 day
  return `${days} days ago`;                                                 // more than 1 day
}

// ==============================================================
// COMPONENT
// ==============================================================
function NotificationBell() {
  const [open, setOpen] = useState(false);                 // panel open or closed
  const [notifications, setNotifications] = useState([]);  // list from the backend
  const [loading, setLoading] = useState(true);            // true during the first load
  const [error, setError] = useState(null);                // error message if something fails
  const [markingAll, setMarkingAll] = useState(false);     // true while "mark all" runs
  const wrapRef = useRef(null);                            // whole bell box (for outside click)
  const btnRef = useRef(null);                             // bell button (to give focus back)

  // ------------------------------------------------------------
  // LOAD  -  get notifications from the backend
  // ------------------------------------------------------------
  const load = useCallback(async () => {
    try {
      const result = await apiCall('/notifications');         // GET /notifications
      setNotifications(Array.isArray(result) ? result : []);  // save the list
      setError(null);                                         // clear old error
    } catch (requestError) {
      setError(requestError.message);  // keep the error text
    } finally {
      setLoading(false);  // loading is done
    }
  }, []);

  // ------------------------------------------------------------
  // EFFECTS  -  refresh, open and close behaviour
  // ------------------------------------------------------------
  // keep the red number fresh
  useEffect(() => {
    load();  // load once at the start
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();  // refresh every 30s if tab is visible
    }, 30000);
    window.addEventListener('focus', load);  // refresh when user returns to the tab
    return () => {
      window.clearInterval(interval);             // stop the timer
      window.removeEventListener('focus', load);  // remove the listener
    };
  }, [load]);

  // refresh the list each time the panel opens
  useEffect(() => {
    if (open) load();  // only when open
  }, [open, load]);

  // close on outside click or Escape key
  useEffect(() => {
    const onMouseDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);  // click outside
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);           // close the panel
        btnRef.current?.focus();  // focus goes back to the bell
      }
    };
    document.addEventListener('mousedown', onMouseDown);  // listen for clicks
    document.addEventListener('keydown', onKeyDown);      // listen for keys
    return () => {
      document.removeEventListener('mousedown', onMouseDown);  // clean up clicks
      document.removeEventListener('keydown', onKeyDown);      // clean up keys
    };
  }, []);

  // ------------------------------------------------------------
  // VALUES  -  numbers used in the screen
  // ------------------------------------------------------------
  const unreadCount = notifications.filter((n) => !n.is_read).length;  // unread total
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);      // show 9+ if too many
  const preview = notifications.slice(0, PREVIEW_LIMIT);               // latest few only

  // ------------------------------------------------------------
  // ACTIONS  -  mark as read
  // ------------------------------------------------------------
  // mark one notification as read
  async function markOneRead(notification) {
    if (notification.is_read) return;  // already read, do nothing
    try {
      await apiCall(`/notifications/${notification.id}/read`, 'PATCH');  // update the backend first
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),  // then the screen
      );
    } catch (requestError) {
      setError(requestError.message);  // keep the error text
    }
  }

  // mark all notifications as read
  async function markAllRead() {
    setMarkingAll(true);  // button shows "Marking..."
    try {
      await apiCall('/notifications/read-all', 'PATCH');                             // update the backend
      setNotifications((current) => current.map((n) => ({ ...n, is_read: true })));  // update the screen
      setError(null);                                                                // clear old error
    } catch (requestError) {
      setError(requestError.message);  // keep the error text
    } finally {
      setMarkingAll(false);  // button back to normal
    }
  }

  // ------------------------------------------------------------
  // SCREEN
  // ------------------------------------------------------------
  return (
    <div className="notif-bell" ref={wrapRef}>
      {/* bell button */}
      <button
        ref={btnRef}
        type="button"
        className={`notif-bell-btn${open ? ' is-open' : ''}`}                                    // is-open when panel is open
        onClick={() => setOpen((o) => !o)}                                                       // click to open or close
        aria-haspopup="true"                                                                     // tells screen readers a popup opens
        aria-expanded={open}                                                                     // tells screen readers if it is open
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}  // spoken name
      >
        {/* bell drawing */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {/* red number, only when something is unread */}
        {unreadCount > 0 && <span className="notif-bell-badge">{badgeText}</span>}
      </button>

      {/* panel, only exists when open */}
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          {/* top: title and mark all button */}
          <div className="notif-panel-head">
            <span className="notif-panel-title">Notifications</span>
            <button
              type="button"
              className="notif-panel-markall"
              onClick={markAllRead}                       // mark everything as read
              disabled={markingAll || unreadCount === 0}  // off while working or nothing unread
            >
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          </div>

          {/* middle: list of notifications */}
          <div className="notif-panel-list">
            {loading && <p className="notif-panel-empty">Loading notifications…</p>}
            {!loading && error && notifications.length === 0 && (
              <p className="notif-panel-empty">{error}</p>
            )}
            {!loading && !error && preview.length === 0 && (
              <p className="notif-panel-empty">You're all caught up.</p>
            )}
            {preview.map((n) => {
              const look = appearance(n.type);  // icon and colour for this row
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.is_read ? '' : ' is-unread'}`}  // is-unread gives blue background
                  onClick={() => markOneRead(n)}                            // click marks it as read
                >
                  {/* round icon */}
                  <span className={`notif-item-icon tone-${look.tone}`}>
                    <svg {...ICON}>{PATHS[look.icon]}</svg>
                  </span>
                  {/* title, message and time */}
                  <span className="notif-item-body">
                    <span className="notif-item-title">{TITLES[n.type] || 'System Notification'}</span>
                    <span className="notif-item-msg">{n.message}</span>
                    <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {/* blue dot for unread */}
                  {!n.is_read && <span className="notif-item-dot" aria-label="Unread" />}
                </button>
              );
            })}
          </div>

          {/* bottom: link to the full page */}
          <Link to="/notifications" className="notif-panel-footer" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;  // so Header.jsx can use it