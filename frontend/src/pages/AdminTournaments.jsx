// frontend/src/pages/AdminTournaments.jsx
// Admin page: set the dates of department tournaments.
// A date inside a period uses the football "tournament" timetable;
// every other date uses the standard timetable.
import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { AdminLoading, Spinner } from '../components/Loading';

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDate(date);
}

function statusOf(period, today) {
  if (period.end_date < today) return 'Finished';
  if (period.start_date <= today) return 'Running now';
  return 'Upcoming';
}

function displayDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function AdminTournaments() {
  const [periods, setPeriods] = useState([]);
  const [form, setForm] = useState({ name: '', start_date: tomorrow(), end_date: tomorrow() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await apiCall('/tournaments');
      if (!Array.isArray(rows)) throw new Error('The tournament list was not in the expected format.');
      setPeriods(rows);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function changeStart(value) {
    // keep the end date from sitting before the start date
    setForm((current) => ({
      ...current,
      start_date: value,
      end_date: current.end_date < value ? value : current.end_date,
    }));
  }

  const overlapping = periods.find(
    (p) => form.start_date <= p.end_date && form.end_date >= p.start_date
  );

  async function addPeriod(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await apiCall('/tournaments', 'POST', {
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      setMessage('Tournament dates added. Football bookings already made for these dates were not changed, so check them under Bookings.');
      setForm((current) => ({ ...current, name: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePeriod(period) {
    const label = period.name || `${period.start_date} to ${period.end_date}`;
    const confirmed = window.confirm(
      `Remove "${label}"?\n\nThese dates will go back to the standard football timetable. Bookings already made are not changed.`
    );
    if (!confirmed) return;
    setError('');
    setMessage('');
    try {
      await apiCall(`/tournaments/${period.id}`, 'DELETE');
      setMessage('Tournament dates removed. Check football bookings for those dates under Bookings.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const today = localDate(new Date());
  const runningCount = periods.filter((period) => statusOf(period, today) === 'Running now').length;
  const upcomingCount = periods.filter((period) => statusOf(period, today) === 'Upcoming').length;

  return (
    <div className="admin-maintenance">
      {error && <div className="admin-error" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}

      <div className="tournament-summary" aria-label="Tournament date summary">
        <article><span>Active now</span><strong>{loading ? '—' : runningCount}</strong></article>
        <article><span>Upcoming</span><strong>{loading ? '—' : upcomingCount}</strong></article>
        <article><span>Total periods</span><strong>{loading ? '—' : periods.length}</strong></article>
      </div>

      <form className="admin-action-form admin-maintenance-form" onSubmit={addPeriod}>
        <h3>Set tournament dates</h3>
        <p className="admin-state-message">
          On these dates the football ground uses the tournament timetable (for example, students play 8–10 PM).
          All other dates use the standard timetable.
        </p>
        <label>Name
          <input maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Optional, e.g. Inter-department cup" />
        </label>
        <label>Start date
          <input required type="date" value={form.start_date} onChange={(event) => changeStart(event.target.value)} />
        </label>
        <label>End date
          <input required type="date" min={form.start_date} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
        </label>
        {overlapping && (
          <p className="admin-state-message" role="status">
            These dates overlap "{overlapping.name || `${overlapping.start_date} to ${overlapping.end_date}`}". That is allowed, but one period may be simpler.
          </p>
        )}
        <button className="admin-primary-button" disabled={saving || loading} type="submit">
          {saving ? <Spinner label="Saving tournament dates…" /> : 'Add tournament dates'}
        </button>
      </form>

      <h3>Existing tournament dates</h3>
      {loading ? <AdminLoading label="Loading tournament dates" rows={3} /> : (
        <div className="admin-table-scroll">
          <table className="admin-bookings-table">
            <thead><tr><th>Name</th><th>Start date</th><th>End date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {periods.length === 0 ? (
                <tr><td className="admin-empty-state" colSpan="5">No tournament dates set. Every date uses the standard football timetable.</td></tr>
              ) : periods.map((period) => {
                const status = statusOf(period, today);
                const statusTone = status === 'Running now' ? 'running' : status === 'Upcoming' ? 'upcoming' : 'finished';
                return (
                  <tr key={period.id}>
                    <td data-label="Name">{period.name || 'Tournament dates'}</td>
                    <td data-label="Start date"><time dateTime={period.start_date}>{displayDate(period.start_date)}</time></td>
                    <td data-label="End date"><time dateTime={period.end_date}>{displayDate(period.end_date)}</time></td>
                    <td data-label="Status"><span className={`tournament-status tournament-status-${statusTone}`}>{status}</span></td>
                    <td data-label="Action"><button className="admin-secondary-button" onClick={() => removePeriod(period)} type="button">Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminTournaments;
