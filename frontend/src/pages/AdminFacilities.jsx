import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { clock, shortDay, sportName } from '../utils/adminHelpers';
import { IMAGES } from '../facilityMeta';

const STATUS_LABEL = { active: 'Active', maintenance: 'Under Maintenance', closed: 'Closed' };

const EMPTY_FORM = {
  name: '', type: '', group_name: '', court_label: '', capacity: '', location: 'Main Campus',
  max_duration_minutes: 60, image_url: '', description: '', role: 'everyone',
  weekday_start: '16:00', weekday_end: '22:00', weekend_start: '08:00', weekend_end: '22:00',
};

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
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
  const sportTypes = useMemo(() => [...new Set(facilities.map((f) => f.type).filter(Boolean))], [facilities]);

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

  const field = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  async function addFacility(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const { weekday_start, weekday_end, weekend_start, weekend_end, ...rest } = form;
      await apiCall('/admin/facilities', 'POST', {
        ...rest,
        max_duration_minutes: Number(form.max_duration_minutes),
        hours: { weekday_start, weekday_end, weekend_start, weekend_end },
      });
      setMessage(`${form.name.trim()} was added and is now open for booking.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
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
        <button type="button" className="adm-btn-solid fac-add-btn" aria-expanded={showForm}
          onClick={() => { setShowForm((s) => !s); setFormError(''); }}>
          {showForm ? 'Close' : '+ Add new sport'}
        </button>
      </header>

      {message && <p className="admin-support-notice" role="status">{message}</p>}
      {error && (
        <div className="admin-error" role="alert"><span>{error}</span><button type="button" onClick={load}>Try again</button></div>
      )}

      {showForm && (
        <form className="admin-panel fac-form" onSubmit={addFacility}>
          <div className="admin-panel-heading"><h2>Add a new sport or court</h2></div>
          <p className="fac-hint">
            Use this when the college gets a new sport. To add a second court of an existing sport,
            reuse the same <b>Group name</b> (for example &ldquo;Badminton Court&rdquo;) and give it a court label.
          </p>
          {formError && <div className="admin-error" role="alert"><span>{formError}</span></div>}

          <div className="fac-form-grid">
            <label>Facility name *
              <input required maxLength="50" value={form.name} onChange={field('name')} placeholder="e.g. Squash Court 1" />
            </label>
            <label>Sport *
              <input required list="fac-sports" maxLength="50" value={form.type} onChange={field('type')} placeholder="e.g. Squash" />
              <datalist id="fac-sports">{sportTypes.map((t) => <option key={t} value={sportName(t)} />)}</datalist>
            </label>
            <label>Group name (optional)
              <input maxLength="50" value={form.group_name} onChange={field('group_name')} placeholder="Defaults to the facility name" />
            </label>
            <label>Court label (optional)
              <input maxLength="50" value={form.court_label} onChange={field('court_label')} placeholder="e.g. 1" />
            </label>
            <label>Capacity (people)
              <input type="number" min="1" value={form.capacity} onChange={field('capacity')} />
            </label>
            <label>Location
              <input maxLength="100" value={form.location} onChange={field('location')} />
            </label>
            <label>Longest booking (minutes)
              <input required type="number" min="15" max="480" step="15" value={form.max_duration_minutes} onChange={field('max_duration_minutes')} />
            </label>
            <label>Who can book
              <select value={form.role} onChange={field('role')}>
                <option value="everyone">Everyone (students, staff, public)</option>
                <option value="student">Students only</option>
              </select>
            </label>
            <label>Weekday opens (Mon–Fri)
              <input required type="time" value={form.weekday_start} onChange={field('weekday_start')} />
            </label>
            <label>Weekday closes
              <input required type="time" value={form.weekday_end} onChange={field('weekday_end')} />
            </label>
            <label>Weekend opens (Sat–Sun)
              <input required type="time" value={form.weekend_start} onChange={field('weekend_start')} />
            </label>
            <label>Weekend closes
              <input required type="time" value={form.weekend_end} onChange={field('weekend_end')} />
            </label>
            <label className="fac-wide">Photo address (optional)
              <input maxLength="300" value={form.image_url} onChange={field('image_url')} placeholder="https://… or /images/squash.jpg" />
            </label>
            <label className="fac-wide">Description (optional)
              <textarea maxLength="600" rows="3" value={form.description} onChange={field('description')} />
            </label>
          </div>

          <div className="fac-form-actions">
            <button type="submit" className="admin-primary-button" disabled={saving}>{saving ? 'Adding…' : 'Add facility'}</button>
            <button type="button" className="admin-secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
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
