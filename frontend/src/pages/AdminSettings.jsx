// frontend/src/pages/AdminSettings.jsx
// Admin page: "System Settings & Policies".
// Shows how EVERY facility is allocated (students / staff / commercial), read
// straight from schedule_rules, so it always matches what the booking API enforces.
// Read-only: change timings in the SQL files (src/db/) and tournament dates on the Tournaments tab.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { clock } from '../utils/adminHelpers';
import { COLUMNS, buildPolicy, hasTournamentTimetable, rulesSignature } from '../utils/policyTable';

const lengthLabel = (minutes) => {
  const m = minutes || 120; // facilities with no limit are booked in 2-hour slots
  if (m % 60 === 0) return `${m / 60} ${m === 60 ? 'hour' : 'hours'}`;
  return `${m} minutes`;
};

const longDate = (iso) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`));

// Group facilities by sport (Badminton Court 1 + 2 -> "Badminton Court"), then merge courts that share the same rules.
function buildGroups(facilities, rules) {
  const byGroup = new Map();
  facilities.forEach((facility) => {
    const key = facility.group_name || facility.name;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push({ ...facility, rules: rules.filter((r) => r.facility_id === facility.id) });
  });

  return [...byGroup].map(([name, list]) => {
    const bySignature = new Map();
    list.forEach((facility) => {
      const sig = rulesSignature(facility.rules);
      if (!bySignature.has(sig)) bySignature.set(sig, { rules: facility.rules, facilities: [] });
      bySignature.get(sig).facilities.push(facility);
    });
    return {
      name,
      maxMinutes: list[0].max_duration_minutes,
      allClosed: list.every((f) => !f.is_active),
      tables: [...bySignature.values()],
      courtCount: list.length,
    };
  });
}

function Cell({ cell, commercial }) {
  if (!cell.ranges.length) return <td className="set-closed">Closed</td>;
  return (
    <td className={commercial ? 'set-commercial' : ''}>
      {cell.ranges.map((range) => (
        <div key={`${range.start}-${range.end}-${range.note}`}>
          {clock(range.start)} – {clock(range.end)}
          {range.note && <small className="set-note">{range.note}</small>}
        </div>
      ))}
      {cell.cap && <small className="set-cap">Max {cell.cap} bookings a day</small>}
    </td>
  );
}

function PolicyTable({ rules, view }) {
  const rows = useMemo(() => buildPolicy(rules, view), [rules, view]);
  return (
    <div className="set-table-scroll">
      <table className="set-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            {COLUMNS.map((col) => <th scope="col" key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dow}>
              <th scope="row">{row.name}</th>
              {row.maintenance ? (
                <td colSpan={COLUMNS.length} className="set-maint">
                  Closed for maintenance, {clock(row.maintenance.start)} – {clock(row.maintenance.end)}
                </td>
              ) : (
                COLUMNS.map((col) => (
                  <Cell key={col.key} cell={row.cells[col.key]} commercial={col.key === 'commercial'} />
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EDITABLE_ROLES = [
  ['maintenance', 'Maintenance / closed'], ['student', 'Students'], ['student_female', 'Female students'],
  ['faculty', 'Faculty / Staff'], ['faculty_male', 'Male faculty'], ['faculty_female', 'Female faculty'],
  ['commercial', 'Commercial / Outsiders'], ['any', 'Students or commercial'], ['everyone', 'All users'],
];

function ScheduleRuleRow({ rule, saving, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...rule });
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <tr>
      <td>
        <select value={draft.day_of_week} onChange={(event) => update('day_of_week', Number(event.target.value))}>
          {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
        </select>
      </td>
      <td><input type="time" value={draft.start_time} onChange={(event) => update('start_time', event.target.value)} /></td>
      <td><input type="time" value={draft.end_time} onChange={(event) => update('end_time', event.target.value)} /></td>
      <td>
        <select value={draft.primary_role} onChange={(event) => update('primary_role', event.target.value)}>
          {EDITABLE_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </td>
      <td>
        <select value={draft.timetable || 'all'} onChange={(event) => update('timetable', event.target.value)}>
          <option value="all">All dates</option><option value="standard">Standard</option><option value="tournament">Tournament</option>
        </select>
      </td>
      <td className="schedule-rule-actions">
        <button type="button" className="admin-primary-button" disabled={saving} onClick={() => onSave(draft)}>Save</button>
        <button type="button" className="admin-secondary-button" disabled={saving} onClick={() => onDelete(draft)}>Delete</button>
      </td>
    </tr>
  );
}

function ScheduleEditor({ table, allRules, onSaved, onError }) {
  const [facilityId, setFacilityId] = useState(String(table.facilities[0]?.id || ''));
  const [savingId, setSavingId] = useState(null);
  const [newRule, setNewRule] = useState({
    day_of_week: 1, start_time: '16:00', end_time: '18:00', primary_role: 'everyone',
    timetable: 'all', day_booking_cap: '',
  });

  const facilityRules = allRules
    .filter((rule) => rule.facility_id === Number(facilityId))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  async function save(rule) {
    setSavingId(rule.id);
    try {
      await apiCall(`/admin/settings/rules/${rule.id}`, 'PUT', {
        ...rule,
        facility_id: Number(facilityId),
      });
      onSaved('Schedule rule updated.');
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  async function remove(rule) {
    if (!window.confirm(`Delete the ${DAYS[rule.day_of_week]} schedule from ${rule.start_time} to ${rule.end_time}?`)) return;
    setSavingId(rule.id);
    try {
      await apiCall(`/admin/settings/rules/${rule.id}`, 'DELETE');
      onSaved('Schedule rule deleted.');
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  async function add() {
    setSavingId('new');
    try {
      await apiCall('/admin/settings/rules', 'POST', { ...newRule, facility_id: Number(facilityId) });
      onSaved('Schedule rule added.');
      setNewRule((current) => ({ ...current, start_time: '16:00', end_time: '18:00' }));
    } catch (requestError) {
      onError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="schedule-editor">
      <div className="schedule-editor-head">
        <div>
          <h3>Edit Facility Timings</h3>
          <p>Changes apply immediately to the booking availability and booking API.</p>
        </div>
        {table.facilities.length > 1 && (
          <label>
            Facility
            <select value={facilityId} onChange={(event) => setFacilityId(event.target.value)}>
              {table.facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="schedule-editor-scroll">
        <table className="schedule-editor-table">
          <thead>
            <tr><th>Day</th><th>Start</th><th>End</th><th>Access</th><th>Timetable</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {facilityRules.map((rule) => (
              <ScheduleRuleRow
                key={rule.id}
                rule={rule}
                saving={savingId === rule.id}
                onSave={save}
                onDelete={remove}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="schedule-rule-add">
        <strong>Add timing rule</strong>
        <div className="schedule-rule-fields">
          <select aria-label="New rule day" value={newRule.day_of_week} onChange={(event) => setNewRule({ ...newRule, day_of_week: Number(event.target.value) })}>
            {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
          <input aria-label="New rule start" type="time" value={newRule.start_time} onChange={(event) => setNewRule({ ...newRule, start_time: event.target.value })} />
          <input aria-label="New rule end" type="time" value={newRule.end_time} onChange={(event) => setNewRule({ ...newRule, end_time: event.target.value })} />
          <select aria-label="New rule access" value={newRule.primary_role} onChange={(event) => setNewRule({ ...newRule, primary_role: event.target.value })}>
            {EDITABLE_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="New rule timetable" value={newRule.timetable} onChange={(event) => setNewRule({ ...newRule, timetable: event.target.value })}>
            <option value="all">All dates</option><option value="standard">Standard</option><option value="tournament">Tournament</option>
          </select>
          <button type="button" className="admin-primary-button" onClick={add} disabled={savingId === 'new'}>Add Rule</button>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATIONS = [
  ['Booking updates', 'The booker is notified when a booking is confirmed, waiting for approval, or cancelled.'],
  ['Game reminders', 'Approved bookings get a reminder 24 hours and 2 hours before they start.'],
  ['Maintenance alerts', 'People with bookings inside a new or changed maintenance block are told which bookings may be affected.'],
];

function AdminSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [view, setView] = useState('standard');
  const [scheduleMessage, setScheduleMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiCall('/admin/settings');
      if (!Array.isArray(result.facilities) || !Array.isArray(result.rules)) {
        throw new Error('The settings response was not in the expected format.');
      }
      setData(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => (data ? buildGroups(data.facilities, data.rules) : []), [data]);
  const group = groups.find((g) => g.name === selected) || groups[0];
  const hasTournament = group ? group.tables.some((t) => hasTournamentTimetable(t.rules)) : false;
  const activeView = hasTournament ? view : 'standard';

  async function scheduleSaved(message) {
    setScheduleMessage(message);
    await load();
  }

  return (
    <>
      <header className="admin-page-header">
        <h1>System Settings &amp; Policies</h1>
        <p>
          See how every facility is allocated, how long a booking can be, and which notifications go out.
          Looking for help tickets? Open <Link to="/admin/support">Support Requests</Link>.
        </p>
      </header>

      {error && (
        <p className="admin-error" role="alert">
          {error} <button className="admin-secondary-button" type="button" onClick={load}>Try again</button>
        </p>
      )}
      {scheduleMessage && <p className="admin-support-notice" role="status">{scheduleMessage}</p>}
      {loading && !data && <p className="admin-state-message" role="status">Loading system settings…</p>}

      {data && (
        <>
          <section className="admin-panel" aria-labelledby="set-limits">
            <div className="admin-panel-heading"><h2 id="set-limits">Booking Limits &amp; Rules</h2></div>
            <dl className="set-limits">
              {groups.map((g) => (
                <div key={g.name}>
                  <dt>{g.name}</dt>
                  <dd>{lengthLabel(g.maxMinutes)} per booking</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="admin-panel" aria-labelledby="set-alloc">
            <div className="admin-panel-heading"><h2 id="set-alloc">Day-by-Day Allocation Policies</h2></div>

            <div className="sup-tabs" role="tablist" aria-label="Choose a sport">
              {groups.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  role="tab"
                  aria-selected={g.name === group?.name}
                  className={`sup-tab ${g.name === group?.name ? 'active' : ''}`}
                  onClick={() => setSelected(g.name)}
                >
                  {g.name}
                </button>
              ))}
            </div>

            {group && (
              <>
                {hasTournament && (
                  <div className="set-toolbar">
                    <div className="set-toggle" role="group" aria-label="Timetable">
                      <button type="button" aria-pressed={activeView === 'standard'} onClick={() => setView('standard')}>Standard dates</button>
                      <button type="button" aria-pressed={activeView === 'tournament'} onClick={() => setView('tournament')}>Tournament dates</button>
                    </div>
                    <p>
                      {data.info.active_tournament
                        ? `A tournament is running now (${data.info.active_tournament.name || 'unnamed'}, ${longDate(data.info.active_tournament.start_date)} – ${longDate(data.info.active_tournament.end_date)}), so today uses the tournament timetable.`
                        : 'No tournament is running today, so the standard timetable applies.'}{' '}
                      Set dates on the <Link to="/admin/tournaments">Tournaments</Link> tab.
                    </p>
                  </div>
                )}

                {group.allClosed && <p className="admin-error" role="status">This facility is currently closed for reservations.</p>}

                {group.tables.map((table) => (
                  <div className="set-block" key={table.facilities.map((f) => f.id).join('-')}>
                    {group.courtCount > 1 && (
                      <h3>{table.facilities.map((f) => f.name).join(' and ')}</h3>
                    )}
                    {table.rules.length === 0
                      ? <p className="admin-state-message">No booking rules are set for this facility, so nothing can be booked.</p>
                      : <PolicyTable rules={table.rules} view={activeView} />}
                    <ScheduleEditor
                      table={table}
                      allRules={data.rules}
                      onSaved={scheduleSaved}
                      onError={(message) => setError(message)}
                    />
                  </div>
                ))}
              </>
            )}
          </section>

          <div className="set-pair">
            <section className="admin-panel" aria-labelledby="set-notify">
              <div className="admin-panel-heading"><h2 id="set-notify">Notification Rules</h2></div>
              <ul className="set-list">
                {NOTIFICATIONS.map(([title, text]) => (
                  <li key={title}><strong>{title}</strong><span>{text}</span></li>
                ))}
              </ul>
              <p className="set-footnote">Everyone can switch these off for themselves in their profile settings.</p>
            </section>

            <section className="admin-panel" aria-labelledby="set-info">
              <div className="admin-panel-heading"><h2 id="set-info">System Information</h2></div>
              <dl className="set-info">
                <div><dt>Registered users</dt><dd>{data.info.registered_users.toLocaleString('en-GB')}</dd></div>
                <div><dt>Facilities open</dt><dd>{data.info.open_facilities} of {data.info.total_facilities}</dd></div>
                <div>
                  <dt>Under maintenance today</dt>
                  <dd className={data.info.facilities_in_maintenance ? 'set-warn' : 'set-ok'}>
                    {data.info.facilities_in_maintenance || 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Football timetable today</dt>
                  <dd>{data.info.active_tournament ? 'Tournament' : 'Standard'}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </>
  );
}

export default AdminSettings;
