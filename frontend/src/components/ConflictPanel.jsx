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
import { prettyDate } from '../utils/format';
import './ConflictPanel.css';

function ConflictPanel({ facility, courts, date, start, end, user }) {
  const [availabilityById, setAvailabilityById] = useState(null); // { facilityId: availability }
  const [selectedKey, setSelectedKey] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Refresh availability after the conflict so alternatives reflect the latest bookings.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      courts.map((c) => apiCall(`/facilities/${c.id}/availability?date=${date}`).then((a) => [c.id, a]))
    )
      .then((pairs) => {
        if (!cancelled) {
          setAvailabilityById(Object.fromEntries(pairs));
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message);
          setAvailabilityById({});
        }
      });
    return () => { cancelled = true; };
  }, [courts, date]);

  if (!availabilityById) {
    return <main className="main conflict-page" role="status">Checking alternative slots…</main>;
  }

  // Prefer the same time on another court, then find nearby times on this facility.
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
  const selected = top.find((suggestion) => `${suggestion.facilityId}-${suggestion.start}` === selectedKey);
  const selectedFacility = selected && courts.find((court) => court.id === selected.facilityId);

  return (
    <main className="main conflict-page">
      <div className="conflict-alert" role="alert">
        <span className="conflict-alert-icon" aria-hidden="true">!</span>
        <div>
          <strong>Booking Conflict Detected</strong>
          <p>The slot you selected was booked by someone else moments ago. Choose an available alternative.</p>
        </div>
      </div>

      {loadError && (
        <p className="conflict-load-error" role="alert">
          Could not check current availability: {loadError}
        </p>
      )}

      <div className="conflict-layout">
        <section className="conflict-request-card">
          <h2>Unavailable Selection</h2>
          <dl>
            <div><dt>Facility</dt><dd>{facility.name}</dd></div>
            <div><dt>Requested date &amp; time</dt><dd className="conflict-requested">{prettyDate(date)}<br />{start} – {end}</dd></div>
            <div><dt>Reason</dt><dd>This specific time was booked while you were confirming.</dd></div>
          </dl>
          <Link to={`/facilities/${facility.id}?date=${date}`} className="conflict-back">
            Back to Facility Availability
          </Link>
        </section>

        <section className="conflict-options-card">
          <h2>Recommended Alternative Slots</h2>
          <p className="conflict-options-subtitle">Choose an open session to continue with a new booking.</p>
          {top.length > 0 ? (
            <div className="conflict-suggestions">
              {top.map((suggestion, index) => {
                const key = `${suggestion.facilityId}-${suggestion.start}`;
                const court = courts.find((item) => item.id === suggestion.facilityId);
                const isSelected = key === selectedKey;
                return (
                  <button
                    className={`conflict-suggestion${isSelected ? ' selected' : ''}`}
                    key={key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedKey(key)}
                  >
                    <span className="conflict-suggestion-top">
                      <strong>Suggestion {index + 1}</strong>
                      <small>Open slot</small>
                    </span>
                    <strong className="conflict-suggestion-facility">{court?.name || facility.name}</strong>
                    <span>{prettyDate(date)}</span>
                    <span className="conflict-suggestion-time">{suggestion.start} – {suggestion.end}</span>
                    <span className="conflict-suggestion-label">{suggestion.facilityId === facility.id ? 'Alternative time' : 'Same time · another court'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="conflict-empty">
              {loadError ? 'Availability could not be loaded. Please return to the availability page and try again.' : 'No other slots are available on this date. Try another date or facility.'}
            </p>
          )}

          <div className="conflict-selection">
            <span>
              {selected && selectedFacility
                ? `Selected: ${selectedFacility.name}, ${selected.start} – ${selected.end}`
                : 'Select an alternative slot to continue.'}
            </span>
            {selected && (
              <Link
                className="conflict-continue"
                to={`/book?facility_id=${selected.facilityId}&date=${date}&start=${selected.start}&end=${selected.end}`}
              >
                Select Alternative &amp; Continue to Booking
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ConflictPanel;