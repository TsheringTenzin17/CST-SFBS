// =============================================================
// frontend/src/components/ConflictPanel.jsx  —  "slot taken, try these"  
// =============================================================
// Shown by BookingForm when the server answers 409 (someone booked the
// slot a moment earlier). Suggests up to 3 free alternatives:
//   1. the SAME time on another court of the same sport (e.g. Badminton Court 2)
//   2. the nearest free slots on the same court the same day
// Sections:  1. load fresh availability   2. build suggestions   3. render
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCall } from '../utils/api';
import { buildSlots, findAlternatives, slotState } from '../utils/slots';

function ConflictPanel({ facility, courts, date, start, end, user }) {
  const [availabilityById, setAvailabilityById] = useState(null); // { facilityId: availability }

  // ---------- 1. load fresh availability for every court of this sport ----------
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      courts.map((c) => apiCall(`/facilities/${c.id}/availability?date=${date}`).then((a) => [c.id, a]))
    )
      .then((pairs) => { if (!cancelled) setAvailabilityById(Object.fromEntries(pairs)); })
      .catch(() => { if (!cancelled) setAvailabilityById({}); });
    return () => { cancelled = true; };
  }, [courts, date, start]);

  if (!availabilityById) return <div className="conflict-box">Checking other options…</div>;

  // ---------- 2. build suggestions ----------
  const slotMinutes = facility.max_duration_minutes || 120;
  const suggestions = [];

  // 2a. same time, other court
  for (const c of courts) {
    if (c.id === facility.id) continue;
    const av = availabilityById[c.id];
    if (!av) continue;
    const match = buildSlots(av.rules, slotMinutes).find((s) => s.start === start && s.end === end);
    if (match && slotState(match, { date, availability: av, user }) === 'open') {
      suggestions.push({ facilityId: c.id, label: `${c.name}, same time`, start, end });
    }
  }

  // 2b. nearest free slots on this court
  const here = availabilityById[facility.id];
  for (const s of findAlternatives({ availability: here, slotMinutes, date, user, aroundStart: start, limit: 3 })) {
    suggestions.push({ facilityId: facility.id, label: `${facility.name}, ${s.start} – ${s.end}`, start: s.start, end: s.end });
  }
  const top = suggestions.slice(0, 3);

  // ---------- 3. render ----------
  return (
    <div className="conflict-box">
      <strong>Booking conflict detected.</strong> This slot was just booked by someone else.
      {top.length > 0 ? (
        <>
          <div className="conflict-title">Try one of these instead:</div>
          <div className="suggestion-list">
            {top.map((s) => (
              <Link
                key={`${s.facilityId}-${s.start}`}
                className="suggestion"
                to={`/book?facility_id=${s.facilityId}&date=${date}&start=${s.start}&end=${s.end}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="conflict-title">Nothing else is free on this day.</div>
      )}
      <Link to={`/facilities/${facility.id}?date=${date}`} className="conflict-back">See all slots for this day</Link>
    </div>
  );
}

export default ConflictPanel;