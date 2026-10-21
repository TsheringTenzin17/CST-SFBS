import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

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

function AdminMaintenance() {
  const [facilities, setFacilities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState({
    facility_id: '',
    start_date: tomorrow(),
    end_date: tomorrow(),
    reason: '',
  });
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

  async function addBlock(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const result = await apiCall('/maintenance', 'POST', {
        facility_id: Number(form.facility_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
      });
      setMessage(`Maintenance block added.${result.affected_bookings ? ` ${result.affected_bookings} existing booking(s) fall within this period.` : ''}`);
      setForm((current) => ({ ...current, reason: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id) {
    setError('');
    setMessage('');
    try {
      await apiCall(`/maintenance/${id}`, 'DELETE');
      setMessage('Maintenance block removed.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="admin-maintenance">
      {error && <div className="admin-error" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}

      <form className="admin-action-form admin-maintenance-form" onSubmit={addBlock}>
        <h3>Close a facility</h3>
        <label>Facility
          <select required value={form.facility_id} onChange={(event) => setForm({ ...form, facility_id: event.target.value })}>
            {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
        </label>
        <label>Start date
          <input required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
        </label>
        <label>End date
          <input required type="date" min={form.start_date} value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
        </label>
        <label>Reason
          <input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Optional maintenance details" />
        </label>
        <button className="admin-primary-button" disabled={saving || loading || !facilities.length} type="submit">
          {saving ? 'Saving…' : 'Add maintenance block'}
        </button>
      </form>

      <h3>Existing blocks</h3>
      {loading ? <p className="admin-state-message" role="status">Loading maintenance blocks…</p> : (
        <div className="admin-table-scroll">
          <table className="admin-bookings-table">
            <thead><tr><th>Facility</th><th>Start date</th><th>End date</th><th>Reason</th><th>Action</th></tr></thead>
            <tbody>
              {blocks.length === 0 ? (
                <tr><td className="admin-empty-state" colSpan="5">No maintenance blocks.</td></tr>
              ) : blocks.map((block) => (
                <tr key={block.id}>
                  <td>{block.facility_name}</td>
                  <td>{block.start_date}</td>
                  <td>{block.end_date}</td>
                  <td>{block.reason || '—'}</td>
                  <td><button className="admin-secondary-button" onClick={() => removeBlock(block.id)} type="button">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminMaintenance;
