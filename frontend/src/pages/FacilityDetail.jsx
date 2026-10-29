// =============================================================
// frontend/src/pages/FacilityDetail.jsx  —  slots for one facility  (owner: Lhamo)
// =============================================================
// Route:  /facilities/:id   (optionally  ?date=2026-10-20)
// Sections:  1. data loading   2. loading / error screens   3. page layout
//
// If this page is BLANK, check in this order:
//   a) App.jsx has  <Route path="/facilities/:id" element={<FacilityDetail />} />
//   b) the import is  import FacilityDetail from './pages/FacilityDetail';
//   c) the browser console (F12) for a red error.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { apiCall } from '../utils/api';
import { ROLE_LABELS, STATE_LABELS, buildSlots, slotState, todayString, toHHMM, toMin } from '../utils/slots';
import { DESCRIPTIONS, IMAGES } from '../facilityMeta';
import './FacilityDetail.css';

// ---------------------------------------------------------------
// Weekday closed hours
// ---------------------------------------------------------------
// DSA: on weekdays the facilities open at 4:00 PM. Between 8:00 AM and
// 4:00 PM (Monday to Friday) nothing can be booked, by anyone. The server
// already refuses those times (no booking rule covers them); here we only
// SHOW them as greyed "Unavailable" slots instead of leaving a gap.
// (The football 6:00 to 8:00 AM student slot is a normal rule and stays bookable.)
const WEEKDAY_CLOSED = { from: '08:00', to: '16:00' };

// 'YYYY-MM-DD' -> true for Monday to Friday (uses the browser's own date)
function isWeekday(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay(); // 0 = Sunday ... 6 = Saturday
  return day >= 1 && day <= 5;
}

// The full list of slots to draw for one day: the bookable slots from the
// rules, plus (on weekdays) the greyed closed slots, in time order.
// Closed slots are marked  closed: true  and have no rule.
function buildDaySlots(rules, slotMinutes, date) {
  const bookable = buildSlots(rules, slotMinutes);
  if (!isWeekday(date)) return bookable;

  const closed = [];
  for (let s = toMin(WEEKDAY_CLOSED.from); s + slotMinutes <= toMin(WEEKDAY_CLOSED.to); s += slotMinutes) {
    const slot = { start: toHHMM(s), end: toHHMM(s + slotMinutes), rule: null, closed: true };
    // never hide a real bookable slot behind a closed one
    const overlapsBookable = bookable.some((b) => toMin(b.start) < toMin(slot.end) && toMin(b.end) > toMin(slot.start));
    if (!overlapsBookable) closed.push(slot);
  }
  return [...bookable, ...closed].sort((a, b) => toMin(a.start) - toMin(b.start));
}

function getWeekDates(date) {
  const monday = new Date(`${date}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

function formatDay(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

const OUTDOOR_TYPES = ['football', 'volleyball', 'archery'];

function facilityCategory(type) {
  return OUTDOOR_TYPES.includes(type) ? 'Outdoor Facility' : 'Indoor Facility';
}

function categoryIcon(type) {
  if (type === 'football') return '⚽';
  if (type === 'basketball') return '🏀';
  if (type === 'volleyball') return '🏐';
  if (type === 'badminton') return '🏸';
  if (type === 'table_tennis') return '🏓';
  return '🎯';
}

function FacilityDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---------- 1. data loading ----------
  const [allFacilities, setAllFacilities] = useState(null);
  const [date, setDate] = useState(searchParams.get('date') || todayString());
  const [weeklyAvailability, setWeeklyAvailability] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const weekDates = getWeekDates(date);
  const weekStart = weekDates[0];

  // 1a. every facility (needed for the name and for the court tabs)
  useEffect(() => {
    apiCall('/facilities').then(setAllFacilities).catch((e) => setError(e.message));
  }, []);

  // 1b. rules + bookings for THIS facility across the chosen week
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    const dates = getWeekDates(weekStart);
    Promise.all(dates.map((day) =>
      apiCall(`/facilities/${id}/availability?date=${day}`).then((data) => [day, data]),
    ))
      .then((entries) => { if (!cancelled) setWeeklyAvailability(Object.fromEntries(entries)); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, weekStart]);

  // ---------- 2. loading / error screens ----------
  if (!allFacilities) {
    return <main className="main">{error ? <p className="error">{error}</p> : <p>Loading facility…</p>}</main>;
  }
  const facility = allFacilities.find((f) => f.id === Number(id));
  if (!facility) {
    return (
      <main className="main">
        <p className="error">Facility not found.</p>
        <Link to="/facilities">Back to facilities</Link>
      </main>
    );
  }

  // ---------- 3. page layout ----------
  const courts = allFacilities.filter((f) => f.group_name === facility.group_name); // e.g. Badminton 1 + 2
  const slotMinutes = facility.max_duration_minutes || 120; // courts 1h, football 2h
  const slotsByDate = Object.fromEntries(weekDates.map((day) => [
    day,
    weeklyAvailability[day] ? buildDaySlots(weeklyAvailability[day].rules, slotMinutes, day) : [],
  ]));
  const slotRows = [...new Map(
    Object.values(slotsByDate).flat().map((slot) => [`${slot.start}-${slot.end}`, { start: slot.start, end: slot.end }]),
  ).values()].sort((a, b) => toMin(a.start) - toMin(b.start));

  function handleBook() {
    if (!selected) return;
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/book?facility_id=${id}&date=${selected.date}&start=${selected.start}&end=${selected.end}`);
  }

  return (
    <main className="fd-page">
      <aside className="fd-left">
        <section className="fd-card fd-info-card">
          <Link to="/facilities" className="fd-back-link">All facilities</Link>
          <div className="fd-category">
            <span className="fd-category-icon" aria-hidden="true">{categoryIcon(facility.type)}</span>
            <span>{facilityCategory(facility.type)}</span>
          </div>
          <h1 className="fd-title">{facility.name}</h1>
          <img
            className="fd-img"
            src={facility.image_url || IMAGES[facility.type]}
            alt={`${facility.name} facility`}
            onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
          />
          <p className="fd-desc">{facility.description || DESCRIPTIONS[facility.type] || ''}</p>
          <div className="fd-facts">
            <span>{facility.location}</span>
            <span>Capacity {facility.capacity}</span>
            {facility.max_duration_minutes && <span>{facility.max_duration_minutes / 60}-hour booking limit</span>}
          </div>
          {courts.length > 1 && (
            <nav className="court-tabs" aria-label="Courts in this facility">
              {courts.map((court) => (
                <Link key={court.id} to={`/facilities/${court.id}?date=${date}`} className={court.id === facility.id ? 'court-tab active' : 'court-tab'}>
                  {court.name}
                </Link>
              ))}
            </nav>
          )}
        </section>

        <section className="fd-card fd-rules-card">
          <h2 className="fd-subtitle">Day-Specific Allocation Rules</h2>
          {weekDates.map((day) => {
            const dayAvailability = weeklyAvailability[day];
            return (
              <div className="fd-rule" key={day}>
                <strong className="fd-rule-day">{formatDay(day)}</strong>
                <div className="fd-rule-details">
                  {dayAvailability?.rules.length ? dayAvailability.rules.map((rule) => (
                    <div className="fd-rule-line" key={`${rule.start_time}-${rule.end_time}`}>
                      <span>{rule.start_time}–{rule.end_time}</span>
                      <span>{ROLE_LABELS[rule.primary_role] || rule.primary_role}</span>
                    </div>
                  )) : <span className="fd-muted">{dayAvailability ? 'No booking rules' : 'Loading rules…'}</span>}
                </div>
              </div>
            );
          })}
        </section>
      </aside>

      <section className="fd-card fd-availability-card">
        <div className="fd-grid-head">
          <div>
            <h2 className="fd-grid-title">Weekly Availability Grid</h2>
            <p className="fd-muted">Select an open slot to begin your booking.</p>
          </div>
          <div className="fd-legend" aria-label="Availability legend">
            <span><i className="fd-dot fd-green" />Available</span>
            <span><i className="fd-dot fd-red" />Booked</span>
            <span><i className="fd-dot fd-gray" />Unavailable</span>
            <span><i className="fd-dot fd-orange" />Selected</span>
          </div>
        </div>

        <div className="fd-week-control">
          <label htmlFor="week-date">Week containing</label>
          <input id="week-date" type="date" value={date} min={todayString()} onChange={(event) => setDate(event.target.value)} />
          <span>{formatDay(weekDates[0])} – {formatDay(weekDates[6])}</span>
        </div>

        {error && <p className="fd-error">{error}</p>}
        {loading && <p className="fd-muted" role="status">Loading this week’s availability…</p>}

        <div className="fd-grid-scroll">
          <div className="fd-grid" role="table" aria-label="Weekly facility availability">
            <div className="fd-row fd-header-row" role="row">
              <span className="fd-day fd-time" role="columnheader">Time</span>
              {weekDates.map((day) => <span className="fd-day" role="columnheader" key={day}>{formatDay(day)}</span>)}
            </div>
            {slotRows.map((row) => (
              <div className="fd-row" role="row" key={`${row.start}-${row.end}`}>
                <span className="fd-time" role="rowheader">{formatTime(row.start)} – {formatTime(row.end)}</span>
                {weekDates.map((day) => {
                  const slot = slotsByDate[day].find((item) => item.start === row.start && item.end === row.end);
                  const dayAvailability = weeklyAvailability[day];
                  const state = !slot || !dayAvailability
                    ? 'unavailable'
                    : slot.closed ? 'closed' : slotState(slot, { date: day, availability: dayAvailability, user });
                  const isSelected = selected?.date === day && selected.start === row.start && selected.end === row.end;
                  const stateClass = state === 'open' ? 'fd-available' : state === 'booked' ? 'fd-booked' : 'fd-unavailable';
                  const label = state === 'open' ? 'Available'
                    : state === 'booked' ? STATE_LABELS.booked
                      : state === 'restricted' ? STATE_LABELS.restricted : STATE_LABELS[state] || 'Unavailable';
                  return (
                    <button
                      type="button"
                      role="cell"
                      key={day}
                      className={`fd-cell ${stateClass}${isSelected ? ' fd-selected' : ''}`}
                      disabled={state !== 'open' || loading}
                      aria-label={`${formatDay(day)}, ${formatTime(row.start)} to ${formatTime(row.end)}: ${label}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelected({ date: day, start: row.start, end: row.end })}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
            {!loading && slotRows.length === 0 && <p className="fd-muted">No time slots are configured for this week.</p>}
          </div>
        </div>

        <div className="fd-footer">
          <div>
            <span className="fd-muted">Selected slot</span>
            <p className="fd-selected">
              {selected ? `${formatDay(selected.date)} · ${formatTime(selected.start)} – ${formatTime(selected.end)}` : 'None'}
            </p>
          </div>
          <button type="button" className="fd-book" disabled={!selected || loading} onClick={handleBook}>
            {selected && !user ? 'Sign In to Book' : 'Select Slot & Book'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default FacilityDetail;