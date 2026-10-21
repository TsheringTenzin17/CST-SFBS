// =============================================================
// frontend/src/pages/AdminReports.jsx  —  the "Reports" tab  (owner: Euden, stretch)
// =============================================================
// Numbers come from GET /admin/reports. "Download CSV" builds a spreadsheet
// file in the browser from GET /bookings, so nothing extra is needed on the server.
import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

// One horizontal bar per row, widths relative to the biggest value.
function Bars({ rows, labelKey }) {
  const max = Math.max(1, ...rows.map((r) => r.bookings));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r[labelKey]}>
          <span className="bar-label">{r[labelKey]}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.bookings / max) * 100}%` }} /></div>
          <span className="bar-value">{r.bookings}</span>
        </div>
      ))}
      {rows.length === 0 && <p>No bookings yet.</p>}
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

  if (error) return <p className="error">{error}</p>;
  if (!report) return <p>Loading report…</p>;

  const { totals } = report;
  const cancelRate = totals.total === 0 ? 0 : Math.round((totals.cancelled / totals.total) * 100);

  return (
    <>
      <div className="stat-cards four">
        <div className="stat-card"><b>{totals.total}</b>Total bookings</div>
        <div className="stat-card"><b>{totals.confirmed}</b>Confirmed</div>
        <div className="stat-card"><b>{cancelRate}%</b>Cancellation rate</div>
        <div className="stat-card"><b>{report.total_users}</b>Registered users</div>
      </div>

      <div className="report-grid">
        <section className="report-box"><h3>Bookings by facility</h3><Bars rows={report.by_facility} labelKey="name" /></section>
        <section className="report-box"><h3>Bookings by role</h3><Bars rows={report.by_role} labelKey="role" /></section>
      </div>

      <button className="btn-primary" onClick={downloadCsv}>Download all bookings (CSV)</button>
    </>
  );
}

export default AdminReports;