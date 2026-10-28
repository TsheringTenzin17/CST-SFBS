import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import './LiveNotice.css';

function noticeKind(type = '') {
  if (type.includes('maintenance')) return 'maintenance';
  if (type.includes('announcement') || type.includes('system')) return 'announcement';
  return null;
}

export default function LiveNotice() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return undefined;

    let active = true;
    const loadNotices = async () => {
      try {
        const notifications = await apiCall('/notifications');
        if (!active) return;
        setNotices(notifications.filter((item) => noticeKind(item.type)).slice(0, 8));
      } catch {
        // The ticker is non-essential and must not interrupt the rest of the page.
      }
    };

    loadNotices();
    const refresh = window.setInterval(loadNotices, 30000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [user]);

  if (!user || user.role === 'admin' || dismissed || notices.length === 0) return null;

  const combinedText = notices.map((notice) => notice.message).join('      •      ');

  return (
    <aside className="live-notice" aria-label="Live campus notices">
      <div className="live-notice-label">
        <span aria-hidden="true" className="live-notice-dot" />
        Live notice
      </div>
      <div className={`live-notice-track${paused ? ' paused' : ''}`}>
        <div className="live-notice-content">
          {notices.map((notice, index) => (
            <span key={notice.id || `${notice.type}-${index}`}>
              <strong>{noticeKind(notice.type) === 'maintenance' ? 'Maintenance:' : 'Announcement:'}</strong>{' '}
              {notice.message}
              {index < notices.length - 1 && <i aria-hidden="true">◆</i>}
            </span>
          ))}
        </div>
      </div>
      <button
        className="live-notice-control"
        type="button"
        aria-label={paused ? 'Resume notice' : 'Pause notice'}
        title={paused ? 'Resume notice' : 'Pause notice'}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? '▶' : 'Ⅱ'}
      </button>
      <Link className="live-notice-details" to="/notifications">Details</Link>
      <button className="live-notice-close" type="button" aria-label="Dismiss notices" onClick={() => setDismissed(true)}>×</button>
      <span className="sr-only">{combinedText}</span>
    </aside>
  );
}
