import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-10-22' -> '22 Oct 2026'
function longDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

// Today in Bhutan time (UTC+6), whatever the browser's timezone is
const bhutanToday = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

const emptyForm = (facilityId = '') => ({
  facility_id: facilityId,
  start_date: tomorrow(),
  end_date: tomorrow(),
  reason: '',
});

function blockStatus(block, today) {
  if (block.end_date < today) return { key: 'ended', label: 'Ended' };
  if (block.start_date <= today) return { key: 'active', label: 'Active' };
  return { key: 'upcoming', label: 'Upcoming' };
}

function AdminMaintenance() {
  const [facilities, setFacilities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [facilityRows, blockRows] = await Promise.all([
        apiCall('/facilities'),
        apiCall('/maintenance'),
      ]);
      setFacilities(facilityRows);
      setBlocks(blockRows);
      setForm((current) => ({
        ...current,
        facility_id: current.facility_id || String(facilityRows[0]?.id || ''),
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function startEdit(block) {
    setError('');
    setMessage('');
    setEditingId(block.id);
    setForm({
      facility_id: String(block.facility_id),
      start_date: block.start_date,
      end_date: block.end_date,
      reason: block.reason || '',
    });
  }

  function stopEdit() {
    setEditingId(null);
    setForm(emptyForm(String(facilities[0]?.id || '')));
  }

  async function saveBlock(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    const body = {
      facility_id: Number(form.facility_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
    };
    try {
      const result = editingId
        ? await apiCall(`/maintenance/${editingId}`, 'PATCH', body)
        : await apiCall('/maintenance', 'POST', body);
      const affected = result.affected_bookings
        ? ` ${result.affected_bookings} existing booking(s) fall within this period.`
        : '';
      setMessage(`${editingId ? 'Maintenance block updated.' : 'Maintenance block added.'}${affected}`);
      if (editingId) stopEdit();
      else setForm((current) => ({ ...current, reason: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(block) {
    if (!window.confirm(`Remove the maintenance block for ${block.facility_name}?`)) return;
    setError('');
    setMessage('');
    try {
      await apiCall(`/maintenance/${block.id}`, 'DELETE');
      setMessage('Maintenance block removed.');
      if (editingId === block.id) stopEdit();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const today = bhutanToday();
  const current = blocks.filter((b) => b.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = blocks.filter((b) => b.end_date < today);
  const visible = showPast ? [...current, ...past] : current;

  return (
    <div className="mt-page">
      <header className="mt-header">
        <h1>Maintenance Blocks Scheduler</h1>
        <p>Define downtime and prevent general bookings during maintenance operations.</p>
      </header>

      {error && <div className="admin-error" role="alert">{error}</div>}
      {message && <div className="mt-success" role="status">{message}</div>}

      <div className="mt-grid">
        <section className="mt-card" aria-labelledby="mt-form-title">
          <h2 id="mt-form-title">{editingId ? 'Edit Block' : 'Schedule New Block'}</h2>
          <form className="mt-form" onSubmit={saveBlock}>
            <label>Select Facility
              <select required value={form.facility_id} onChange={setField('facility_id')}>
                {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
            </label>
            <label>Start Date
              <input required type="date" value={form.start_date} onChange={setField('start_date')} />
            </label>
            <label>End Date
              <input required type="date" min={form.start_date} value={form.end_date} onChange={setField('end_date')} />
            </label>
            <label>Reason / Description
              <textarea value={form.reason} maxLength={500} onChange={setField('reason')} placeholder="Optional maintenance details" />
            </label>
            <button className="mt-submit" disabled={saving || loading || !facilities.length} type="submit">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Block Facility'}
            </button>
            {editingId && (
              <button className="mt-cancel-edit" onClick={stopEdit} type="button">Cancel editing</button>
            )}
          </form>
        </section>

        <section className="mt-card" aria-labelledby="mt-list-title">
          <h2 id="mt-list-title">Active &amp; Upcoming Maintenance Blocks</h2>

          {loading ? (
            <p className="admin-state-message" role="status">Loading maintenance blocks…</p>
          ) : visible.length === 0 ? (
            <p className="admin-empty-state">No active or upcoming maintenance blocks.</p>
          ) : (
            <div className="mt-list">
              {visible.map((block) => {
                const status = blockStatus(block, today);
                return (
                  <article key={block.id} className={`mt-block${editingId === block.id ? ' is-editing' : ''}`}>
                    <div className="mt-block-head">
                      <h3>{block.facility_name}</h3>
                      <span className={`mt-badge mt-badge-${status.key}`}>{status.label}</span>
                    </div>
                    <div className="mt-label">Period</div>
                    <div className="mt-value">{longDate(block.start_date)} - {longDate(block.end_date)}</div>
                    <div className="mt-label">Reason</div>
                    <div className="mt-value">{block.reason || '—'}</div>
                    <div className="mt-block-actions">
                      <button className="mt-edit" onClick={() => startEdit(block)} type="button">Edit</button>
                      <button className="mt-delete" onClick={() => removeBlock(block)} type="button">Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && past.length > 0 && (
            <button className="mt-past-toggle" onClick={() => setShowPast(!showPast)} type="button">
              {showPast ? 'Hide past blocks' : `Show past blocks (${past.length})`}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminMaintenance;
