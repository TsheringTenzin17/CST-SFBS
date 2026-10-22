// =============================================================
// frontend/src/pages/AdminReports.jsx  —  the "Reports" tab
// =============================================================
// Numbers come from GET /admin/reports. "Download CSV" builds a spreadsheet
// file in the browser from GET /bookings, so nothing extra is needed on the server.
import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

// One horizontal bar per row, widths relative to the biggest value.
function Bars({ rows, labelKey, colorByLabel = false }) {
  const max = Math.max(1, ...rows.map((r) => r.bookings));
  return (
    <div className="rep-bars">
      {rows.map((r) => {
        const label = r[labelKey];
        const colorClass = colorByLabel ? `fill-${String(label).toLowerCase()}` : '';
        return (
          <div className="rep-bar-row" key={label}>
            <span className="rep-bar-label">{label}</span>
            <div className="rep-bar-track">
              <div className={`rep-bar-fill ${colorClass}`} style={{ width: `${(r.bookings / max) * 100}%` }} />
            </div>
            <b className="rep-bar-value">{r.bookings}</b>
          </div>
        );
      })}
      {rows.length === 0 && <p className="admin-state-message">No bookings yet.</p>}
    </div>
  );
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

  if (error) return <div className="admin-error rep-root" role="alert"><span>{error}</span></div>;
  if (!report) return <p className="admin-state-message rep-root" role="status">Loading report…</p>;

  const { totals } = report;
  const cancelRate = totals.total === 0 ? 0 : Math.round((totals.cancelled / totals.total) * 100);

  return (
    <div className="rep-root">
      <div className="rep-toolbar">
        <p>Overview of all bookings across your facilities.</p>
        <button className="admin-primary-button" onClick={downloadCsv} type="button">
          Download all bookings (CSV)
        </button>
      </div>

      <section className="admin-stats" aria-label="Report totals">
        <article className="admin-stat-card"><span>Total bookings</span><strong>{totals.total}</strong></article>
        <article className="admin-stat-card"><span>Confirmed</span><strong className="admin-stat-green">{totals.confirmed}</strong></article>
        <article className="admin-stat-card"><span>Cancellation rate</span><strong className="admin-stat-red">{cancelRate}%</strong></article>
        <article className="admin-stat-card"><span>Registered users</span><strong className="admin-stat-blue">{report.total_users}</strong></article>
      </section>

      <div className="rep-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Bookings by facility</h2></div>
          <Bars rows={report.by_facility} labelKey="name" />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Bookings by role</h2></div>
          <Bars rows={report.by_role} labelKey="role" colorByLabel />
        </section>
      </div>
    </div>
  );
}

export default AdminReports;