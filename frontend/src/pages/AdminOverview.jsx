import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { getUsageRows } from '../utils/adminHelpers';

const TZ = 'Asia/Thimphu';
const todayBhutan = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', outsider: 'Commercial', admin: 'Admin' };
const ROLE_SHORT = { student: 'Stu', faculty: 'Staff', outsider: 'Comm.', admin: 'Admin' };

function clock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

function slotText(b) {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${b.booking_date}T00:00:00Z`));
  return `${b.facility_name} (${day}, ${clock(b.start_time)} - ${clock(b.end_time)})`;
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function downloadCsv(bookingList) {
  const header = ['Booking ID', 'Requester', 'Role', 'Facility', 'Date', 'Start', 'End', 'Status', 'Purpose'];
  const lines = bookingList.map((b) =>
    [`B-${b.id}`, b.user_name, b.user_role, b.facility_name, b.booking_date, b.start_time, b.end_time, b.status, b.purpose]
      .map(csvCell).join(','));
  const blob = new Blob([`﻿${[header.join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'cst-sfbs-bookings.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function StatCard({ label, children, tone }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong className={tone}>{children}</strong>
    </article>
  );
}

export default function AdminOverview({ bookingList, user, onReload }) {
  const [facilities, setFacilities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [rejecting, setRejecting] = useState(null); // { id, reason }
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([apiCall('/facilities'), apiCall('/maintenance')])
      .then(([f, m]) => {
        if (!active) return;
        setFacilities(Array.isArray(f) ? f : []);
        setBlocks(Array.isArray(m) ? m : []);
      })
      .catch(() => {}); // the arena card simply shows "—" if this fails
    return () => { active = false; };
  }, []);

  const today = todayBhutan();
  const todayCount = bookingList.filter((b) => b.booking_date === today && b.status !== 'cancelled').length;
  const pending = bookingList.filter((b) => b.status === 'pending')
    .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));

  const closedToday = new Set(
    blocks.filter((m) => m.start_date <= today && today <= m.end_date).map((m) => m.facility_id)
  );
  const operational = facilities.filter((f) => !closedToday.has(f.id)).length;
  const arenasKnown = facilities.length > 0;

  const usage = getUsageRows(bookingList);
  const maxUsage = Math.max(1, ...usage.map(([, n]) => n));

  async function act(id, body, doneText) {
    setBusyId(id);
    setError('');
    setMessage('');
    try {
      await apiCall(`/bookings/${id}`, 'PATCH', body);
      setMessage(doneText);
      setRejecting(null);
      await onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function submitReject(event) {
    event.preventDefault();
    if (!rejecting.reason.trim()) {
      setError('Please enter a reason so the requester knows why.');
      return;
    }
    act(rejecting.id, { status: 'cancelled', reason: rejecting.reason.trim() }, `Request R-${rejecting.id} rejected.`);
  }

  const firstName = user?.full_name || 'Admin';

  return (
    <>
      <section className="adm-hero" style={{ '--hero-img': 'url(/images/cst.jpg)' }}>
        <p className="adm-eyebrow">CST Campus / Phuentsholing, Bhutan</p>
        <h1>System Overview &amp; Live Triage</h1>
        <p className="adm-hero-lead">
          Welcome back, {firstName}.{' '}
          {pending.length > 0
            ? `${pending.length} pending reservation${pending.length === 1 ? '' : 's'} require${pending.length === 1 ? 's' : ''} attention.`
            : 'No reservations are waiting for approval.'}
        </p>
        <div className="adm-hero-actions">
          <button type="button" className="adm-btn-solid" onClick={() => downloadCsv(bookingList)}>Export CSV log</button>
          <Link to="/admin/bookings" className="adm-btn-outline">Manage bookings</Link>
        </div>
        <small>For system administrators and facility managers.</small>
      </section>

      <section className="admin-stats" aria-label="Booking statistics">
        <StatCard label="Total Bookings Today" tone="admin-stat-blue">{todayCount} {todayCount === 1 ? 'Request' : 'Requests'}</StatCard>
        <StatCard label="Pending Approvals" tone="admin-stat-amber">{pending.length} Awaiting</StatCard>
        <StatCard label="Operational Arenas" tone="admin-stat-green">
          {arenasKnown ? `${operational} / ${facilities.length} Active` : '—'}
        </StatCard>
      </section>

      <section className="admin-panel" aria-label="Reservations requiring manual approval">
        <div className="admin-panel-heading"><h2>Reservations Requiring Manual Approval</h2></div>

        {message && <p className="admin-support-notice" role="status">{message}</p>}
        {error && <div className="admin-error" role="alert"><span>{error}</span></div>}

        {pending.length === 0 ? (
          <p className="admin-state-message">Nothing to approve right now.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="adm-triage">
              <thead>
                <tr><th>Req ID</th><th>Requester</th><th>Facility &amp; Slot</th><th>Role</th><th className="adm-triage-end">Triage</th></tr>
              </thead>
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id}>
                    <td className="adm-req-id">R-{b.id}</td>
                    <td className="adm-req-name">{b.user_name} ({ROLE_SHORT[b.user_role] || b.user_role})</td>
                    <td>{slotText(b)}</td>
                    <td className={b.user_role === 'outsider' ? 'adm-role-comm' : 'adm-role'}>{ROLE_LABEL[b.user_role] || b.user_role}</td>
                    <td className="adm-triage-end">
                      <div className="admin-row-actions">
                        <button type="button" className="adm-approve" disabled={busyId === b.id}
                          onClick={() => act(b.id, { status: 'approved' }, `Request R-${b.id} approved.`)}>Approve</button>
                        <button type="button" className="adm-reject" disabled={busyId === b.id}
                          onClick={() => { setError(''); setMessage(''); setRejecting({ id: b.id, reason: '' }); }}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rejecting && (
          <form className="admin-action-form" onSubmit={submitReject}>
            <h3>Reject request R-{rejecting.id}</h3>
            <label>Reason (sent to the requester)
              <textarea required value={rejecting.reason}
                onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} />
            </label>
            <button className="admin-cancel-button" disabled={busyId === rejecting.id} type="submit">
              {busyId === rejecting.id ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => setRejecting(null)}>Close</button>
          </form>
        )}
      </section>

      <section className="admin-panel" aria-label="Facility usage overview for the last 7 days">
        <div className="admin-panel-heading">
          <h2>Facility Usage Overview</h2>
          <span>Last 7 days</span>
        </div>
        {usage.length === 0 ? (
          <p className="admin-state-message">No facility bookings in the last 7 days.</p>
        ) : (
          <ul className="adm-usage">
            {usage.map(([name, count]) => (
              <li key={name}>
                <span className="adm-usage-name">{name}</span>
                <span className="adm-usage-track"><span className="adm-usage-fill" style={{ width: `${(count / maxUsage) * 100}%` }} /></span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
