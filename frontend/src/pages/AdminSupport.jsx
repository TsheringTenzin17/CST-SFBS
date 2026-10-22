import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

const STATUSES = [
  ['pending_review', 'Pending review'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
];

const statusLabel = (value) => (STATUSES.find(([v]) => v === value) || [value, value])[1];

function AdminSupport() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [emailingId, setEmailingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await apiCall('/admin/support-requests'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function updateStatus(request, status) {
    setSavingId(request.id);
    setError('');
    setNotice('');
    try {
      const result = await apiCall(`/admin/support-requests/${request.id}`, 'PATCH', { status });
      setRequests((current) => current.map((item) => item.id === request.id ? result.request : item));
      if (status === 'resolved') setNotice('Request resolved. You can now email the requester an update.');
    } catch (requestError) {
      setError(requestError.message);
      await loadRequests();
    } finally {
      setSavingId(null);
    }
  }

  async function sendResolutionEmail(request) {
    setEmailingId(request.id);
    setError('');
    setNotice('');
    try {
      const result = await apiCall(`/admin/support-requests/${request.id}/notify-resolution`, 'POST');
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEmailingId(null);
    }
  }

  const list = Array.isArray(requests) ? requests : [];
  const count = (status) => list.filter((r) => r.status === status).length;
  const visible = filter === 'all' ? list : list.filter((r) => r.status === filter);

  const tabs = [
    ['all', 'All', list.length],
    ['pending_review', 'Pending', count('pending_review')],
    ['in_progress', 'In progress', count('in_progress')],
    ['resolved', 'Resolved', count('resolved')],
  ];

  return (
    <section className="admin-support">
      <div className="sup-toolbar">
        <p>Review submitted requests and update their status. After resolving, use the email button on the ticket to notify the requester.</p>
        <button className="admin-primary-button" onClick={loadRequests} type="button">Refresh</button>
      </div>

      <div className="admin-stats" aria-label="Ticket summary">
        <article className="admin-stat-card"><span>Pending review</span><strong className="sup-num-warn">{count('pending_review')}</strong></article>
        <article className="admin-stat-card"><span>In progress</span><strong className="admin-stat-blue">{count('in_progress')}</strong></article>
        <article className="admin-stat-card"><span>Resolved</span><strong className="admin-stat-green">{count('resolved')}</strong></article>
      </div>

      <div className="sup-tabs" role="tablist" aria-label="Filter tickets">
        {tabs.map(([value, label, n]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={`sup-tab ${filter === value ? 'active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-support-notice" role="status">{notice}</p>}

      {loading ? <p className="admin-state-message" role="status">Loading support requests…</p>
        : visible.length === 0 ? <p className="admin-state-message">{list.length ? 'No tickets in this view.' : 'No support requests yet.'}</p>
          : (
            <div className="sup-list">
              {visible.map((request) => (
                <article className={`sup-card sup-${request.status}`} key={request.id}>
                  <header className="sup-head">
                    <div>
                      <strong>Ticket #{request.id} · {request.name}</strong>
                      <a href={`mailto:${request.email}`}>{request.email}</a>
                    </div>
                    <div className="sup-meta">
                      <span className={`sup-badge sup-${request.status}`}>{statusLabel(request.status)}</span>
                      <time>{request.created_at}</time>
                    </div>
                  </header>

                  <p className="sup-message">{request.message}</p>

                  <footer className="sup-foot">
                    <label className="sup-status">
                      Status
                      <select
                        className={`sup-select sup-${request.status}`}
                        value={request.status}
                        disabled={savingId === request.id}
                        onChange={(event) => updateStatus(request, event.target.value)}
                      >
                        {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    {request.status === 'resolved' && (
                      <button
                        className="admin-secondary-button"
                        disabled={emailingId === request.id}
                        onClick={() => sendResolutionEmail(request)}
                        type="button"
                      >
                        {emailingId === request.id ? 'Sending…' : 'Email resolution update'}
                      </button>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          )}
    </section>
  );
}

export default AdminSupport;