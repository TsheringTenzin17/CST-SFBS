import { Link } from 'react-router-dom';
import { CHART_COLORS, getUsageRows } from '../utils/adminHelpers';

const QUICK_ACTIONS = [
  { to: '/admin/maintenance', title: 'Block maintenance period', text: 'Schedule downtime for facilities' },
  { to: '/admin/reports', title: 'Export booking report', text: 'Download CSV log' },
  { to: '/admin/bookings', title: 'Manage bookings', text: 'Reschedule or cancel' },
  { to: '/admin/users', title: 'Manage user roles', text: 'Update permissions' },
];

function StatCard({ label, value, tone }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </article>
  );
}

function UsageChart({ rows }) {
  const total = rows.reduce((sum, [, count]) => sum + count, 0);

  if (rows.length === 0) {
    return <p className="admin-state-message">No facility bookings in the last 7 days.</p>;
  }

  let offset = 0;
  const stops = rows.map(([, count], i) => {
    const start = offset;
    offset += (count / total) * 100;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}% ${offset}%`;
  });

  return (
    <div className="admin-usage-content">
      <div
        className="admin-usage-pie"
        role="img"
        aria-label={`Pie chart showing ${total} bookings across ${rows.length} facilities`}
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
      />
      <ul className="admin-usage-legend">
        {rows.map(([name, count], i) => (
          <li key={name}>
            <span className="admin-usage-color" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="admin-usage-name">{name}</span>
            <strong>{count}</strong>
            <span className="admin-usage-percent">{Math.round((count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminOverview({ bookingList }) {
  const activeCount = bookingList.filter((b) => b.status === 'approved').length;
  const cancelledCount = bookingList.filter((b) => b.status === 'cancelled').length;
  const facilityCount = new Set(bookingList.map((b) => b.facility_name).filter(Boolean)).size;

  return (
    <>
      <section className="admin-stats" aria-label="Booking statistics">
        <StatCard label="Total Bookings" value={bookingList.length} />
        <StatCard label="Active" value={activeCount} tone="admin-stat-blue" />
        <StatCard label="Cancelled" value={cancelledCount} tone="admin-stat-red" />
        <StatCard label="Facilities Booked" value={facilityCount} tone="admin-stat-green" />
      </section>

      <section className="admin-panel" aria-label="Facility usage overview for the last 7 days">
        <div className="admin-panel-heading">
          <h2>Facility Usage Overview</h2>
          <span>Last 7 days</span>
        </div>
        <UsageChart rows={getUsageRows(bookingList)} />
      </section>

      <section className="admin-panel" aria-label="Quick actions">
        <div className="admin-panel-heading"><h2>Quick Actions</h2></div>
        <div className="adm-actions">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} className="adm-card-link" to={a.to}>
              <b>{a.title}</b>
              <span>{a.text}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}