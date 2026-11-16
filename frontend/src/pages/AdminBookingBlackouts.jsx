import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { todayString } from '../utils/slots';
import { AdminLoading, Spinner } from '../components/Loading';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function longDate(date) {
  const [year, month, day] = String(date).split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

function emptyForm() {
  const today = todayString();
  return { start_date: today, end_date: today, reason: '' };
}

function periodStatus(period, today) {
  if (period.end_date < today) return { key: 'ended', label: 'Ended' };
  if (period.start_date <= today) return { key: 'active', label: 'Active' };
  return { key: 'upcoming', label: 'Upcoming' };
}

function AdminBookingBlackouts() {
  const [periods, setPeriods] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await apiCall('/booking-blackouts');
      if (!Array.isArray(result)) throw new Error('Booking restrictions response was not a list.');
      setPeriods(result);
    } catch (requestError) {
      setLoadError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const today = todayString();
  const currentPeriods = periods
    .filter((period) => period.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const pastPeriods = periods.filter((period) => period.end_date < today);
  const visiblePeriods = showPast ? [...currentPeriods, ...pastPeriods] : currentPeriods;

  function editPeriod(period) {
    setError('');
    setMessage(null);
    setEditingId(period.id);
    setForm({
      start_date: period.start_date,
      end_date: period.end_date,
      reason: period.reason,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function savePeriod(event) {
    event.preventDefault();
    setError('');
    setMessage(null);
    setSaving(true);
    const body = {
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
    };

    try {
      const result = editingId
        ? await apiCall(`/booking-blackouts/${editingId}`, 'PATCH', body)
        : await apiCall('/booking-blackouts', 'POST', body);
      const affected = Number(result.affected_bookings || 0);
      setMessage({
        type: affected ? 'warning' : 'success',
        text: affected
          ? `Restriction saved. ${affected} existing student booking${affected === 1 ? '' : 's'} remain active during this period.`
          : 'Restriction saved. No existing student bookings are affected.',
      });
      if (editingId) cancelEdit();
      else setForm(emptyForm());
      await loadPeriods();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePeriod(period) {
    if (!window.confirm(`Remove the booking restriction for ${period.reason}?`)) return;
    setError('');
    setMessage(null);
    setDeletingId(period.id);
    try {
      await apiCall(`/booking-blackouts/${period.id}`, 'DELETE');
      if (editingId === period.id) cancelEdit();
      setMessage({ type: 'success', text: 'Booking restriction removed.' });
      await loadPeriods();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-grid mt-blackout-grid">
      <section className="mt-card" aria-labelledby="blackout-form-title">
        <h2 id="blackout-form-title">
          {editingId ? 'Edit Campus Restriction' : 'Block Booking Dates'}
        </h2>
        <p className="mt-blackout-intro">
          Pause student bookings across every facility for exams, tests, or other campus events.
          Existing student bookings will stay active.
        </p>

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div
            className={message.type === 'warning' ? 'mt-blackout-warning' : 'mt-success'}
            role={message.type === 'warning' ? 'alert' : 'status'}
          >
            {message.text}
          </div>
        )}

        <form className="mt-form" onSubmit={savePeriod}>
          <label>
            Start date
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  start_date: event.target.value,
                  end_date:
                    current.end_date < event.target.value ? event.target.value : current.end_date,
                }))
              }
            />
          </label>
          <label>
            End date
            <input
              type="date"
              required
              min={form.start_date}
              value={form.end_date}
              onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
            />
          </label>
          <label>
            Reason
            <textarea
              required
              maxLength={500}
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Examinations, tests, or campus event"
            />
          </label>
          <small className="mt-blackout-help">
            For a single day, use the same start and end date. Overlapping restrictions must be
            edited together.
          </small>
          <button className="mt-submit" type="submit" disabled={saving || loading}>
            {saving ? (
              <Spinner label="Saving restriction…" />
            ) : editingId ? (
              'Save Changes'
            ) : (
              'Block Dates'
            )}
          </button>
          {editingId && (
            <button className="mt-cancel-edit" type="button" onClick={cancelEdit}>
              Cancel editing
            </button>
          )}
        </form>
      </section>

      <section className="mt-card" aria-labelledby="blackout-list-title">
        <h2 id="blackout-list-title">Student Booking Restrictions</h2>
        <p className="mt-blackout-intro">
          Student bookings are disabled across all facilities during these periods.
        </p>
        {loading ? (
          <AdminLoading label="Loading booking restrictions" rows={3} />
        ) : loadError ? (
          <div className="admin-error" role="alert">
            {loadError}
          </div>
        ) : visiblePeriods.length === 0 ? (
          <p className="admin-empty-state">No active or upcoming booking restrictions.</p>
        ) : (
          <div className="mt-list">
            {visiblePeriods.map((period) => {
              const status = periodStatus(period, today);
              return (
                <article
                  className={`mt-block${editingId === period.id ? ' is-editing' : ''}`}
                  key={period.id}
                >
                  <div className="mt-block-head">
                    <h3>{period.reason}</h3>
                    <span className={`mt-badge mt-badge-${status.key}`}>{status.label}</span>
                  </div>
                  <div className="mt-label">Period</div>
                  <div className="mt-value">
                    {longDate(period.start_date)} – {longDate(period.end_date)}
                  </div>
                  <div className="mt-block-actions">
                    <button className="mt-edit" type="button" onClick={() => editPeriod(period)}>
                      Edit
                    </button>
                    <button
                      className="mt-delete"
                      type="button"
                      disabled={deletingId === period.id}
                      onClick={() => deletePeriod(period)}
                    >
                      {deletingId === period.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!loading && pastPeriods.length > 0 && (
          <button
            className="mt-past-toggle"
            type="button"
            onClick={() => setShowPast((current) => !current)}
          >
            {showPast ? 'Hide past restrictions' : `Show past restrictions (${pastPeriods.length})`}
          </button>
        )}
      </section>
    </div>
  );
}

export default AdminBookingBlackouts;
