import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { getUsageRows } from '../utils/adminHelpers';
import { Spinner } from '../components/Loading';

const TZ = 'Asia/Thimphu';
const todayBhutan = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const todayLabel = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

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
const PIE_COLORS = ['#245562', '#4f8fa0', '#e58e00', '#24a148', '#8d67b5', '#d66b54'];

function usagePieGradient(rows) {
  const total = rows.reduce((sum, [, count]) => sum + Number(count || 0), 0);
  let start = 0;
  const stops = rows.map(([, count], index) => {
    const end = start + (Number(count || 0) / total) * 100;
    const stop = `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

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
    .sort((a, b) => {
      const byCreatedAt = String(b.created_at || '').localeCompare(String(a.created_at || ''));
      return byCreatedAt || Number(b.id) - Number(a.id);
    });

  const closedToday = new Set(
    blocks.filter((m) => m.start_date <= today && today <= m.end_date).map((m) => m.facility_id)
  );
  const operational = facilities.filter((f) => !closedToday.has(f.id)).length;
  const arenasKnown = facilities.length > 0;

  const usage = getUsageRows(bookingList);
  const pieGradient = usage.length > 0 ? usagePieGradient(usage) : '';

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

  useEffect(() => {
    if (!rejecting) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setRejecting(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rejecting]);

  const firstName = user?.full_name || 'Admin';

  return (
    <>
      <section className="adm-hero" style={{ '--hero-img': 'url(/images/cst.jpg)' }}>
        <p className="adm-eyebrow">CST Campus / Phuentsholing, Bhutan</p>
        <div className="adm-hero-topline">
          <span className="adm-status-pill"><i aria-hidden="true" /> Systems operational</span>
          <span className="adm-current-date">{todayLabel()}</span>
        </div>
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
        <div className="admin-panel-heading">
          <div>
            <span className="adm-section-eyebrow">Action required</span>
            <h2>Reservations Requiring Manual Approval</h2>
          </div>
          <span className={`adm-pending-count${pending.length === 0 ? ' is-clear' : ''}`}>
            {pending.length} pending
          </span>
        </div>

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
                    <td className="adm-req-id" data-label="Request ID">R-{b.id}</td>
                    <td className="adm-req-name" data-label="Requester">{b.user_name} ({ROLE_SHORT[b.user_role] || b.user_role})</td>
                    <td data-label="Facility & slot">{slotText(b)}</td>
                    <td className={b.user_role === 'outsider' ? 'adm-role-comm' : 'adm-role'} data-label="Role">{ROLE_LABEL[b.user_role] || b.user_role}</td>
                    <td className="adm-triage-end" data-label="Actions">
                      <div className="admin-row-actions">
                        <button type="button" className="adm-approve" disabled={busyId === b.id}
                          onClick={() => act(b.id, { status: 'approved' }, `Request R-${b.id} approved.`)}>Approve</button>
                        <button type="button" className="adm-reject" disabled={busyId === b.id}
                          onClick={() => { setError(''); setMessage(''); setRejecting({ ...b, id: b.id, reason: '' }); }}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rejecting && (
          <div className="bk-backdrop" onClick={() => setRejecting(null)}>
            <div className="bk-modal" role="dialog" aria-modal="true" aria-labelledby="overview-reject-title"
              onClick={(event) => event.stopPropagation()}>
              <h3 id="overview-reject-title">Reject booking BK-{rejecting.id}</h3>
              <dl className="bk-summary">
                <div><dt>Requester</dt><dd>{rejecting.user_name || '—'}</dd></div>
                <div><dt>Facility</dt><dd>{rejecting.facility_name || '—'}</dd></div>
                <div><dt>Slot</dt><dd>{slotText(rejecting)}</dd></div>
                <div><dt>Status</dt><dd>Pending</dd></div>
              </dl>

              {error && <div className="admin-error" role="alert">{error}</div>}

              <form className="bk-form" onSubmit={submitReject}>
                <h4>Reason for rejection</h4>
                <label>Reason (sent to the requester)
                  <textarea required value={rejecting.reason}
                    onChange={(event) => setRejecting({ ...rejecting, reason: event.target.value })} />
                </label>
                <button className="admin-cancel-button" disabled={busyId === rejecting.id} type="submit">
                  {busyId === rejecting.id ? <Spinner label="Saving booking decision…" /> : 'Confirm rejection'}
                </button>
              </form>
              <div className="bk-modal-footer">
                <button className="admin-secondary-button" type="button" onClick={() => setRejecting(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="admin-panel" aria-label="Facility usage overview for the last 7 days">
        <div className="admin-panel-heading">
          <div>
            <span className="adm-section-eyebrow">Activity insight</span>
            <h2>Facility Usage Overview</h2>
          </div>
          <span className="adm-period">Last 7 days</span>
        </div>
        {usage.length === 0 ? (
          <p className="admin-state-message">No facility bookings in the last 7 days.</p>
        ) : (
          <div className="adm-usage-chart">
            <div className="adm-usage-pie-wrap">
              <div
                className="adm-usage-pie"
                style={{ background: pieGradient }}
                role="img"
                aria-label="Pie chart showing facility usage for the last 7 days"
              >
                <div className="adm-usage-pie-center">
                  <strong>{usage.reduce((sum, [, count]) => sum + count, 0)}</strong>
                  <span>bookings</span>
                </div>
              </div>
            </div>
            <ul className="adm-usage">
              {usage.map(([name, count], index) => (
                <li key={name}>
                  <span className="adm-usage-color" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} aria-hidden="true" />
                  <span className="adm-usage-name">{name}</span>
                  <span className="adm-usage-value">
                    <strong>{count}</strong>
                    <small>{Math.round((count / usage.reduce((sum, [, value]) => sum + value, 0)) * 100)}%</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
