import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

const STATUSES = [
  ['pending_review', 'Pending review'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
];

function AdminSupport() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [emailingId, setEmailingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  return (
    <section className="admin-support">
      <div className="admin-support-toolbar">
        <p>Review submitted requests and update their status. Resolving a ticket emails the requester.</p>
        <button className="admin-secondary-button" onClick={loadRequests} type="button">Refresh</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-support-notice" role="status">{notice}</p>}
      {loading ? <p className="admin-state-message" role="status">Loading support requests…</p>
        : requests.length === 0 ? <p className="admin-state-message">No support requests yet.</p>
          : (
            <div className="admin-support-list">
              {requests.map((request) => (
                <article className="admin-support-request" key={request.id}>
                  <header>
                    <div>
                      <strong>Ticket #{request.id} · {request.name}</strong>
                      <a href={`mailto:${request.email}`}>{request.email}</a>
                    </div>
                    <time>{request.created_at}</time>
                  </header>
                  <p className="admin-support-message">{request.message}</p>
                  <label>
                    Status
                    <select
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
                </article>
              ))}
            </div>
          )}
    </section>
  );
}

export default AdminSupport;
