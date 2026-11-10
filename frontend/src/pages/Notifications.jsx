import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../utils/api';
import { Skeleton } from '../components/Loading';
import './Notifications.css';

const FILTERS = [
  { id: 'all', label: 'All Notifications' },
  { id: 'unread', label: 'Unread Only' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'system', label: 'System & Maintenance' },
];

function notificationCategory(type = '') {
  // Booking events share a prefix; other notices appear under the system/maintenance filter.
  return type.startsWith('booking_') ? 'bookings' : 'system';
}

// Each type gets its own colour and icon. Unknown types fall back to a neutral info style.
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};
const ICONS = {
  check: (
    <svg {...ICON_PROPS}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  star: (
    <svg {...ICON_PROPS} fill="currentColor" strokeWidth="1.2">
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5z" />
    </svg>
  ),
  warning: (
    <svg {...ICON_PROPS}>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17.2v.1" />
    </svg>
  ),
  alarm: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 9.5V13l2.3 1.5M4.5 5.5L7 3.5M19.5 5.5L17 3.5" />
    </svg>
  ),
  clock: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  cross: (
    <svg {...ICON_PROPS}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  ),
  info: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.1" />
    </svg>
  ),
};

function notificationAppearance(type = '') {
  if (type.includes('cancel')) return { icon: ICONS.cross, className: 'cancelled' };
  if (type.includes('maintenance')) return { icon: ICONS.warning, className: 'maintenance' };
  if (type.includes('pending')) return { icon: ICONS.clock, className: 'pending' };
  if (type.includes('reminder')) return { icon: ICONS.alarm, className: 'reminder' };
  if (type.includes('rescheduled') || type.includes('approved'))
    return { icon: ICONS.star, className: 'update' };
  if (type.includes('confirmed')) return { icon: ICONS.check, className: 'confirmed' };
  return { icon: ICONS.info, className: 'info' };
}

function notificationTitle(type = '') {
  const titles = {
    booking_confirmed: 'Booking Confirmed',
    booking_pending: 'Booking Pending Approval',
    booking_cancelled: 'Booking Cancelled',
    booking_rescheduled: 'Booking Rescheduled',
    booking_reminder: 'Upcoming Activity Reminder',
    maintenance_scheduled: 'Maintenance Scheduled',
  };
  return titles[type] || 'System Notification';
}

// Bold the facility names and dates/times inside a message (plain React text, no raw HTML).
const HIGHLIGHT =
  /(Football Ground|Basketball Court|Volleyball Court(?: \((?:Male|Female)\))?|Badminton Courts?(?: [12])?|Table Tennis Table(?: [12])?|Archery Range|\d{4}-\d{2}-\d{2}(?: \(\d{2}:\d{2}-\d{2}:\d{2}\))?)/g;

function highlightedMessage(message = '') {
  return message
    .split(HIGHLIGHT)
    .map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

function timeAgo(timestamp) {
  // Store the server timestamp for assistive tools, but show a compact relative time in the list.
  const created = new Date(timestamp).getTime();
  if (!Number.isFinite(created)) return '';

  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [swipedId, setSwipedId] = useState(null);
  const [error, setError] = useState(null);
  const touchStartX = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await apiCall('/notifications');
      setNotifications(result);
      setError(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const refreshInterval = window.setInterval(loadNotifications, 30000);
    window.addEventListener('focus', loadNotifications);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', loadNotifications);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filter === 'unread') return !notification.is_read;
        if (filter === 'all') return true;
        return notificationCategory(notification.type) === filter;
      }),
    [filter, notifications],
  );

  async function markAllAsRead() {
    setError(null);
    setMarkingAll(true);
    try {
      // Update the server first; only reflect success in the UI after it confirms the change.
      await apiCall('/notifications/read-all', 'PATCH');
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMarkingAll(false);
    }
  }

  async function markAsRead(notification) {
    if (notification.is_read) return;
    setError(null);
    setMarkingId(notification.id);
    try {
      const result = await apiCall(`/notifications/${notification.id}/read`, 'PATCH');
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? result.notification : item)),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMarkingId(null);
    }
  }

  async function deleteNotification(notification) {
    if (!window.confirm('Delete this notification? This cannot be undone.')) return;

    setError(null);
    setDeletingId(notification.id);
    try {
      await apiCall(`/notifications/${notification.id}`, 'DELETE');
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function clearAllNotifications() {
    if (
      notifications.length === 0 ||
      !window.confirm('Clear all notifications? This cannot be undone.')
    )
      return;

    setError(null);
    setDeletingId('all');
    try {
      await apiCall('/notifications', 'DELETE');
      setNotifications([]);
      setSwipedId(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="main notifications-page">
      <div className="notifications-heading">
        <div>
          <h1 className="title">Notifications</h1>
          <p className="subtitle">
            Keep track of bookings, schedule updates, and alerts. Notifications are automatically
            removed after 7 days; swipe a notification left to reveal its delete action.
          </p>
        </div>
        <div className="notifications-heading-actions">
          <button
            className="notifications-mark-all"
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || markingAll}
          >
            {markingAll ? 'Marking…' : 'Mark All as Read'}
          </button>
          <button
            className="notifications-clear-all"
            type="button"
            onClick={clearAllNotifications}
            disabled={notifications.length === 0 || deletingId === 'all'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m3.5 3v6m5-6v6" />
            </svg>
            {deletingId === 'all' ? 'Clearing…' : 'Clear all'}
          </button>
        </div>
      </div>

      {error && (
        <p className="notifications-error" role="alert">
          {error}
        </p>
      )}

      <div className="notifications-layout">
        <nav className="notifications-filters" aria-label="Filter notifications">
          {FILTERS.map((item) => (
            <button
              className={filter === item.id ? 'active' : ''}
              type="button"
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              {item.id === 'all' && <span>{notifications.length}</span>}
              {item.id === 'unread' && <span>{unreadCount}</span>}
            </button>
          ))}
        </nav>

        <section className="notifications-list" aria-label="Your notifications" aria-live="polite">
          {loading && (
            <div
              className="notifications-skeleton-list"
              role="status"
              aria-label="Loading notifications"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <article
                  className="notification-card notifications-skeleton-card"
                  key={index}
                  aria-hidden="true"
                >
                  <Skeleton className="notifications-skeleton-icon" />
                  <div className="notification-content">
                    <Skeleton className="skeleton-line notifications-skeleton-title" />
                    <Skeleton className="skeleton-line notifications-skeleton-copy" />
                    <Skeleton className="skeleton-line notifications-skeleton-copy short" />
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && visibleNotifications.length === 0 && (
            <p className="notifications-empty">
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : 'There are no notifications in this category yet.'}
            </p>
          )}
          {!loading &&
            visibleNotifications.map((notification) => {
              const appearance = notificationAppearance(notification.type);
              return (
                <article
                  className={`notification-card ${appearance.className}${notification.is_read ? ' read' : ' unread'}${swipedId === notification.id ? ' swiped' : ''}`}
                  key={notification.id}
                  onTouchStart={(event) => {
                    touchStartX.current = event.changedTouches[0].clientX;
                  }}
                  onTouchEnd={(event) => {
                    if (touchStartX.current === null) return;
                    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
                    if (deltaX < -40) setSwipedId(notification.id);
                    if (deltaX > 40) setSwipedId(null);
                    touchStartX.current = null;
                  }}
                >
                  <span className="notification-icon" aria-hidden="true">
                    {appearance.icon}
                  </span>
                  <div className="notification-content">
                    <div className="notification-top">
                      <h2>
                        {notificationTitle(notification.type)}
                        {!notification.is_read && (
                          <span className="notification-dot" aria-label="Unread" />
                        )}
                      </h2>
                      <div className="notification-meta">
                        <time className="notification-time" dateTime={notification.created_at}>
                          {timeAgo(notification.created_at)}
                        </time>
                        <button
                          className="notification-delete"
                          type="button"
                          onClick={() => deleteNotification(notification)}
                          disabled={deletingId === notification.id}
                          aria-label={`Delete ${notificationTitle(notification.type).toLowerCase()} notification`}
                          title="Delete notification"
                        >
                          {deletingId === notification.id ? (
                            'Deleting…'
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m3.5 3v6m5-6v6" />
                              </svg>
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p>{highlightedMessage(notification.message)}</p>
                    {!notification.is_read && (
                      <button
                        className="notification-mark-read"
                        type="button"
                        onClick={() => markAsRead(notification)}
                        disabled={markingId === notification.id}
                      >
                        {markingId === notification.id ? 'Saving…' : 'Mark as read'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
        </section>
      </div>
    </main>
  );
}

export default Notifications;
