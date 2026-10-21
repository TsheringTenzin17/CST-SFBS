import { useEffect, useMemo, useState } from 'react';
import { apiCall } from '../utils/api';
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

function notificationAppearance(type = '') {
  if (type.includes('cancel')) return { icon: '×', className: 'cancelled' };
  if (type.includes('maintenance') || type.includes('system')) return { icon: '!', className: 'maintenance' };
  if (type.includes('rescheduled') || type.includes('approved')) return { icon: '★', className: 'update' };
  return { icon: '✓', className: 'confirmed' };
}

function notificationTitle(type = '') {
  const titles = {
    booking_confirmed: 'Booking Confirmed',
    booking_cancelled: 'Booking Cancelled',
    booking_rescheduled: 'Booking Rescheduled',
    booking_reminder: 'Booking Reminder',
    maintenance_scheduled: 'Maintenance Scheduled',
  };
  return titles[type] || 'System Notification';
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
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    apiCall('/notifications')
      .then((result) => { if (active) setNotifications(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const visibleNotifications = useMemo(() => notifications.filter((notification) => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'all') return true;
    return notificationCategory(notification.type) === filter;
  }), [filter, notifications]);

  async function markAllAsRead() {
    setError(null);
    setMarkingAll(true);
    try {
      // Update the server first; only reflect success in the UI after it confirms the change.
      await apiCall('/notifications/read-all', 'PATCH');
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
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
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? result.notification : item
      )));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <main className="main notifications-page">
      <div className="notifications-heading">
        <div>
          <h1 className="title">Notifications</h1>
          <p className="subtitle">Keep track of booking updates and system notices.</p>
        </div>
        <button
          className="notifications-mark-all"
          type="button"
          onClick={markAllAsRead}
          disabled={unreadCount === 0 || markingAll}
        >
          {markingAll ? 'Marking…' : 'Mark All as Read'}
        </button>
      </div>

      {error && <p className="notifications-error" role="alert">{error}</p>}

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
          {loading && <p className="notifications-empty" role="status">Loading notifications…</p>}
          {!loading && visibleNotifications.length === 0 && (
            <p className="notifications-empty">
              {filter === 'unread' ? 'You have no unread notifications.' : 'There are no notifications in this category yet.'}
            </p>
          )}
          {!loading && visibleNotifications.map((notification) => {
            const appearance = notificationAppearance(notification.type);
            return (
              <article
                className={`notification-card ${appearance.className}${notification.is_read ? ' read' : ' unread'}`}
                key={notification.id}
              >
                <span className="notification-icon" aria-hidden="true">{appearance.icon}</span>
                <div className="notification-content">
                  <h2>{notificationTitle(notification.type)}</h2>
                  <p>{notification.message}</p>
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
                <time className="notification-time" dateTime={notification.created_at}>
                  {timeAgo(notification.created_at)}
                </time>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export default Notifications;