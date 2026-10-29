// =============================================================
// frontend/src/pages/AdminReports.jsx  —  the "Reports & Analytics" tab
// =============================================================
// Numbers come from GET /admin/reports. "Download CSV" builds a spreadsheet
// file in the browser from GET /bookings. "Generate PDF Report" opens the
// browser's print dialog (choose "Save as PDF"); print styles hide the header and footer.
import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

const TZ = 'Asia/Thimphu';
const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', outsider: 'Outsider', admin: 'Admin' };
const STATUS_LABEL = {
  approved: 'Approved', pending: 'Pending', cancelled: 'Cancelled',
  active: 'Active', upcoming: 'Upcoming', ended: 'Ended',
};

const bhutanDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date); // YYYY-MM-DD

// '2026-10-30T04:45:00Z' -> 'Today, 10:45 AM' / 'Yesterday, 04:30 PM' / '24 Oct, 11:00 AM'
function activityTime(iso) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(date);
  const day = bhutanDay(date);
  const today = bhutanDay(new Date());
  const yesterday = bhutanDay(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (day === today) return `Today, ${time}`;
  if (day === yesterday) return `Yesterday, ${time}`;
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' }).format(date);
  return `${label}, ${time}`;
}

// A CSV cell: wrap in quotes and double any quote inside.
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function AdminReports() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiCall('/admin/reports').then(setReport).catch((e) => setError(e.message));
  }, []);

  async function downloadCsv() {
    try {
      const rows = await apiCall('/bookings');
      const header = ['Booking ID', 'Requester', 'Role', 'Facility', 'Date', 'Start', 'End', 'Status', 'Purpose'];
      const lines = rows.map((b) =>
        [`B-${b.id}`, b.user_name, b.user_role, b.facility_name, b.booking_date, b.start_time, b.end_time, b.status, b.purpose].map(csvCell).join(',')
      );
      const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'cst-sfbs-bookings.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="rp-page"><div className="admin-error" role="alert"><span>{error}</span></div></div>;
  if (!report) return <div className="rp-page"><p className="admin-state-message" role="status">Loading report…</p></div>;

  const { month, hours } = report;
  const change = month.last_total > 0 ? Math.round(((month.this_total - month.last_total) / month.last_total) * 100) : null;
  const cancelRate = month.this_total > 0 ? ((month.this_cancelled / month.this_total) * 100).toFixed(1) : '0.0';
  const utilization = hours.open_hours > 0 ? Math.min(100, Math.round((hours.booked_hours / hours.open_hours) * 100)) : 0;

  const facilityMax = Math.max(1, ...report.by_facility.map((r) => r.bookings));
  const roleTotal = report.by_role.reduce((sum, r) => sum + r.bookings, 0);

  return (
    <div className="rp-page">
      <header className="rp-header">
        <h1>Reports &amp; Analytics</h1>
        <p>System-wide performance metrics, arena utilization logs, and analytics.</p>
        <div className="rp-actions">
          <button type="button" onClick={downloadCsv}>Download CSV</button>
          <button type="button" onClick={() => window.print()}>Generate PDF Report</button>
        </div>
      </header>

      <section className="rp-stats" aria-label="Key figures">
        <article>
          <span>Total Bookings This Month</span>
          <strong className="rp-teal">{month.this_total}</strong>
          <small>
            {change === null ? 'No bookings last month' : `${change >= 0 ? '+' : ''}${change}% from last month`}
          </small>
        </article>
        <article>
          <span>Active Users</span>
          <strong>{report.active_users}</strong>
          <small>Booked in the last 30 days</small>
        </article>
        <article>
          <span>Facility Utilization Rate</span>
          <strong>{utilization}%</strong>
          <small>Booked vs. open hours, last 30 days</small>
        </article>
        <article>
          <span>Cancellation Rate</span>
          <strong className="rp-salmon">{cancelRate}%</strong>
          <small>Of this month’s bookings</small>
        </article>
      </section>

      <section className="rp-section" aria-labelledby="rp-fac">
        <h2 id="rp-fac">Bookings by Facility</h2>
        <p className="rp-sub">Distribution across venues</p>
        {report.by_facility.length === 0 ? (
          <p className="admin-state-message">No bookings yet.</p>
        ) : (
          <div className="rp-bars">
            {report.by_facility.map((r) => (
              <div className="rp-bar-row" key={r.name}>
                <span className="rp-bar-label">{r.name}</span>
                <div className="rp-bar-track">
                  <div className="rp-bar-fill" style={{ width: `${(r.bookings / facilityMax) * 55}%` }} />
                </div>
                <b className="rp-bar-value">{r.bookings}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rp-section" aria-labelledby="rp-role">
        <h2 id="rp-role">Bookings by Role</h2>
        {roleTotal === 0 ? (
          <p className="admin-state-message">No bookings yet.</p>
        ) : (
          <>
            <div className="rp-roles">
              {report.by_role.map((r) => (
                <div key={r.role}>
                  <strong className={r.role === 'outsider' ? 'rp-amber' : 'rp-teal'}>
                    {Math.round((r.bookings / roleTotal) * 100)}%
                  </strong>
                  <span>{ROLE_LABEL[r.role] || r.role}</span>
                </div>
              ))}
            </div>
            <p className="rp-caption">{roleTotal} active reservations</p>
          </>
        )}
      </section>

      <section className="rp-section" aria-labelledby="rp-log">
        <h2 id="rp-log">Recent Activity Log</h2>
        <div className="admin-table-scroll">
          <table className="rp-log">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Facility</th><th>Status</th></tr>
            </thead>
            <tbody>
              {report.recent_activity.length === 0 ? (
                <tr><td className="admin-empty-state" colSpan="5">No activity yet.</td></tr>
              ) : (
                report.recent_activity.map((e, i) => (
                  <tr key={`${e.happened_at}-${i}`}>
                    <td>{activityTime(e.happened_at)}</td>
                    <td>{e.user_name} ({ROLE_LABEL[e.user_role] || e.user_role})</td>
                    <td>{e.action}</td>
                    <td>{e.facility}</td>
                    <td className="rp-status">{STATUS_LABEL[e.status] || e.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminReports;
