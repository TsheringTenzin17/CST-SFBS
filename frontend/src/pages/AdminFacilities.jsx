import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { clock, shortDay } from '../utils/adminHelpers';
import { IMAGES } from '../facilityMeta';

const STATUS_LABEL = { active: 'Active', maintenance: 'Under Maintenance', closed: 'Closed' };

function nextSlotText(slot, today) {
  if (!slot) return 'N/A';
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const day = slot.date === today ? 'Today'
    : slot.date === tomorrow.toISOString().slice(0, 10) ? 'Tomorrow'
    : shortDay(slot.date);
  return `${day}, ${clock(slot.start_time)}`;
}

function FacilityCard({ f, today, busy, onToggle }) {
  const image = f.image_url || IMAGES[f.type];
  return (
    <article className="fac-card">
      {image ? (
        <img className="fac-img" src={image} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      ) : (
        <div className="fac-img fac-img-empty" aria-hidden="true">{f.name.charAt(0)}</div>
      )}
      <div className="fac-body">
        <div className="fac-title-row">
          <h3>{f.name}</h3>
          <span className={`fac-badge fac-${f.status}`}>{STATUS_LABEL[f.status]}</span>
        </div>
        <dl className="fac-stats">
          <div><dt>Today&apos;s Bookings</dt><dd className="fac-big">{f.today_bookings}</dd></div>
          <div><dt>Next Available Slot</dt><dd className="fac-next">{nextSlotText(f.next_slot, today)}</dd></div>
        </dl>
        <div className="fac-toggle-row">
          <span id={`fac-allow-${f.id}`}>Allow Reservations</span>
          <button type="button" role="switch" aria-checked={f.is_active} aria-labelledby={`fac-allow-${f.id}`}
            className={`fac-switch ${f.is_active ? 'on' : ''}`} disabled={busy}
            onClick={() => onToggle(f)}>
            <span />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminFacilities() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const location = useLocation();
  const [message, setMessage] = useState(location.state?.message || ''); // e.g. "Squash Court was added"
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await apiCall('/admin/facilities'));
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load facilities.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const facilities = data?.facilities || [];
  const arenaCount = useMemo(() => new Set(facilities.map((f) => f.group_name || f.name)).size, [facilities]);

  async function toggle(f) {
    setBusyId(f.id);
    setMessage('');
    setError('');
    try {
      const result = await apiCall(`/admin/facilities/${f.id}`, 'PATCH', { is_active: !f.is_active });
      if (f.is_active) {
        const n = result.upcoming_bookings;
        setMessage(`${f.name} is closed for new reservations.${n ? ` ${n} existing upcoming booking${n === 1 ? '' : 's'} were kept — cancel or move them from Manage Bookings if needed.` : ''}`);
      } else {
        setMessage(`${f.name} is open for reservations again.`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="admin-page-header fac-header">
        <div>
          <h1>Facilities Status</h1>
          <p>
            Monitor, block, and control the reservation status of CST&apos;s
            {data ? ` ${arenaCount}` : ''} sports arenas.
          </p>
        </div>
        <Link to="/admin/facilities/new" className="adm-btn-solid fac-add-btn">+ Add new sport</Link>
      </header>

      {message && <p className="admin-support-notice" role="status">{message}</p>}
      {error && (
        <div className="admin-error" role="alert"><span>{error}</span><button type="button" onClick={load}>Try again</button></div>
      )}

      {!data && !error && <p className="admin-state-message" role="status">Loading facilities…</p>}

      <section className="fac-grid" aria-label="Facilities">
        {facilities.map((f) => (
          <FacilityCard key={f.id} f={f} today={data.today} busy={busyId === f.id} onToggle={toggle} />
        ))}
      </section>

      {data && (
        <section className="admin-panel" aria-label="Scheduled downtime overview">
          <div className="admin-panel-heading">
            <h2>Scheduled Downtime Overview</h2>
            <Link to="/admin/maintenance">Manage maintenance blocks</Link>
          </div>
          {data.downtime.length === 0 ? (
            <p className="admin-state-message">No maintenance is scheduled.</p>
          ) : (
            <ul className="fac-downtime">
              {data.downtime.map((d) => (
                <li key={d.id}>
                  <span className={`fac-dot fac-dot-${d.state}`} aria-hidden="true" />
                  <div>
                    <b>{d.facility_name}{d.reason ? ` — ${d.reason}` : ''}</b>
                    <small>
                      {d.start_date === d.end_date ? shortDay(d.start_date) : `${shortDay(d.start_date)} - ${shortDay(d.end_date)}`}
                      {d.state === 'active' ? ' (In Progress)' : ''}
                    </small>
                  </div>
                  <span className={`fac-state fac-state-${d.state}`}>{d.state === 'active' ? 'Active' : 'Upcoming'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
