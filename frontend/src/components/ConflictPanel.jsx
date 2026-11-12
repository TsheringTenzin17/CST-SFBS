// =============================================================
// frontend/src/components/ConflictPanel.jsx  —  "slot taken, try these"
// =============================================================
// Shown by BookingForm when the server answers 409 (someone booked the
// slot a moment earlier). Suggests up to 3 free alternatives:
//   1. the SAME time on another court of the same sport (e.g. Badminton Court 2)
//   2. the nearest free slots on the same court the same day
// Sections:  1. load fresh availability   2. build suggestions   3. render
import { useEffect, useState } from 'react';                                // Import useEffect (run code) and useState (store values)
import { Link } from 'react-router-dom';                                    // Import Link to move between pages without reloading
import { apiCall } from '../utils/api';                                     // Import the helper that talks to the server
import { buildSlots, findAlternatives, slotState } from '../utils/slots';   // Import the helpers that work with time slots
import { prettyDate } from '../utils/format';                               // Import the helper that makes dates easy to read
import './ConflictPanel.css';                                               // Import the styles for this panel

// ConflictPanel shows other free slots when the chosen slot was taken
function ConflictPanel({ facility, courts, date, start, end, user }) {      // Values this panel receives from BookingForm
  const [availabilityById, setAvailabilityById] = useState(null);    // Availability of each court, saved by court id
  const [selectedKey, setSelectedKey] = useState(null);              // Which suggestion the user clicked
  const [loadError, setLoadError] = useState(null);                  // Error message if loading fails

  // ---------- Section 1: load fresh availability ----------
  // Refresh availability after the conflict so alternatives reflect the latest bookings.
  useEffect(() => {
    let cancelled = false;                                           // Becomes true if the panel is closed before loading ends
    Promise.all(                                                     // Wait until all the courts are loaded
      courts.map((c) =>                                              // Go through every court
        apiCall(`/facilities/${c.id}/availability?date=${date}`).then((a) => [c.id, a]),    // Ask the server, then keep [court id, availability]
      ),
    )
      .then((pairs) => {                                             // When all courts are loaded
        if (!cancelled) {                                            // Only continue if the panel is still open
          setAvailabilityById(Object.fromEntries(pairs));            // Turn the pairs into an object and save it
          setLoadError(null);                                        // Clear any old error
        }
      })
      .catch((error) => {                                            // If something went wrong
        if (!cancelled) {                                            // Only continue if the panel is still open
          setLoadError(error.message);                               // Save the error message to show it
          setAvailabilityById({});                                   // Save an empty object so the loading screen stops
        }
      });
    return () => {                                                   // Cleanup: runs when the panel is removed
      cancelled = true;                                              // Tell the code above to ignore late results
    };
  }, [courts, date]);                                                // Run again when the courts or the date change

  // Show a loading card until the availability is ready
  if (!availabilityById) {                                           // If the data is not loaded yet
    return (
      <main className="main conflict-page" role="status">            {/* Page wrapper; "status" tells screen readers it is loading */}
        <div className="conflict-loading-card">                      {/* Card that holds the spinner and text */}
          <span className="conflict-loading-spinner" aria-hidden="true" />    {/* Spinning circle; hidden from screen readers */}
          <div>                                                      {/* Wrapper for the loading text */}
            <strong>Checking the latest availability</strong>        {/* Loading title */}
            <p>Finding alternatives that are currently open…</p>     {/* Loading message under the title */}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Section 2: build suggestions ----------
  // Prefer the same time on another court, then find nearby times on this facility.
  const slotMinutes = facility.max_duration_minutes || 120;          // Length of one slot (use 120 minutes if not set)
  const suggestions = [];                                            // List where we collect the suggestions

  // 2a. same time, other court
  for (const c of courts) {                                          // Go through every court
    if (c.id === facility.id) continue;                              // Skip the court that was already taken
    const av = availabilityById[c.id];                               // Get the availability of this court
    if (!av) continue;                                               // Skip if there is no data for it
    const match = buildSlots(av.rules, slotMinutes).find((s) => s.start === start && s.end === end);    // Find the same time slot on this court
    if (match && slotState(match, { date, availability: av, user }) === 'open') {    // If that slot exists and is free
      suggestions.push({ facilityId: c.id, label: `${c.name}, same time`, start, end });    // Add it to the suggestions
    }
  }

  // 2b. nearest free slots on this court
  const here = availabilityById[facility.id];                        // Availability of the court the user wanted
  for (const s of findAlternatives({                                 // Find free slots close to the wanted time
    availability: here,                                              // Availability data of this court
    slotMinutes,                                                     // Length of one slot
    date,                                                            // The chosen date
    user,                                                            // The current user
    aroundStart: start,                                              // Look for slots near this start time
    limit: 3,                                                        // Get at most 3 slots
  })) {
    suggestions.push({                                               // Add each free slot to the suggestions
      facilityId: facility.id,                                       // Same court as the user wanted
      label: `${facility.name}, ${s.start} – ${s.end}`,              // Text that describes the suggestion
      start: s.start,                                                // Start time of the suggestion
      end: s.end,                                                    // End time of the suggestion
    });
  }
  const top = suggestions.slice(0, 3);                               // Keep only the first 3 suggestions
  const selected = top.find(                                         // Find the suggestion the user clicked
    (suggestion) => `${suggestion.facilityId}-${suggestion.start}` === selectedKey,    // Match it using its key
  );
  const selectedFacility = selected && courts.find((court) => court.id === selected.facilityId);    // Find the court of the chosen suggestion

  // ---------- Section 3: render (what shows on the screen) ----------
  return (
    <main className="main conflict-page">                            {/* Main wrapper of the page */}
      <div className="conflict-alert" role="alert">                  {/* Red alert box; "alert" tells screen readers it is important */}
        <span className="conflict-alert-icon" aria-hidden="true">    {/* Round icon; hidden from screen readers */}
          !
        </span>
        <div>                                                        {/* Wrapper for the alert text */}
          <strong>Booking Conflict Detected</strong>                 {/* Alert title */}
          <p>                                                        {/* Alert message (text below is shown as it is) */}
            The slot you selected was booked by someone else moments ago. Choose an available
            alternative.
          </p>
        </div>
        <span className="conflict-alert-status">Slot unavailable</span>    {/* Small status tag on the right */}
      </div>

      {loadError && (                                                // Show the error only if there is one
        <p className="conflict-load-error" role="alert">             {/* Error message paragraph */}
          Could not check current availability: {loadError}
        </p>
      )}

      <div className="conflict-layout">                              {/* Wrapper for the left and right cards */}
        <section className="conflict-request-card">                  {/* Left card: the slot the user wanted */}
          <h2>Unavailable Selection</h2>                             {/* Left card heading */}
          <dl>                                                       {/* List of details (label + value) */}
            <div>                                                    {/* First detail */}
              <dt>Facility</dt>                                      {/* Label: Facility */}
              <dd>{facility.name}</dd>                               {/* Value: the facility name */}
            </div>
            <div>                                                    {/* Second detail */}
              <dt>Requested date &amp; time</dt>                     {/* Label: date and time */}
              <dd className="conflict-requested">                    {/* Value shown in red */}
                {prettyDate(date)}                                   {/* The date in an easy-to-read format */}
                <br />                                               {/* Line break */}
                {start} – {end}                                      {/* Start and end time */}
              </dd>
            </div>
            <div>                                                    {/* Third detail */}
              <dt>Reason</dt>                                        {/* Label: Reason */}
              <dd>This specific time was booked while you were confirming.</dd>    {/* Value: why it failed */}
            </div>
          </dl>
          <Link to={`/facilities/${facility.id}?date=${date}`} className="conflict-back">    {/* Link back to the facility page */}
            <span aria-hidden="true">←</span>                        {/* Arrow icon; hidden from screen readers */}
            Back to Facility Availability
          </Link>
        </section>

        <section className="conflict-options-card">                  {/* Right card: the other slots */}
          <h2>Recommended Alternative Slots</h2>                     {/* Right card heading */}
          <p className="conflict-options-subtitle">                  {/* Small text under the heading */}
            Choose an open session to continue with a new booking.
          </p>
          {top.length > 0 ? (                                        // If there is at least one suggestion
            <div className="conflict-suggestions">                   {/* Wrapper for all suggestion cards */}
              {top.map((suggestion, index) => {                      // Go through each suggestion
                const key = `${suggestion.facilityId}-${suggestion.start}`;                  // Make a unique key for this suggestion
                const court = courts.find((item) => item.id === suggestion.facilityId);     // Find the court of this suggestion
                const isSelected = key === selectedKey;              // Is this the suggestion the user clicked?
                return (
                  <button                                            // Each suggestion is a clickable button
                    className={`conflict-suggestion${isSelected ? ' selected' : ''}`}    // Add "selected" style if it is chosen
                    key={key}                                        // Key so React can track each item
                    type="button"                                    // Normal button (does not submit a form)
                    aria-pressed={isSelected}                        // Tell screen readers if it is chosen
                    onClick={() => setSelectedKey(key)}              // When clicked, save this suggestion as chosen
                  >
                    <span className="conflict-suggestion-top">       {/* Top row of the card */}
                      <strong>Suggestion {index + 1}</strong>        {/* Suggestion number (1, 2, 3) */}
                      <small>Open slot</small>                       {/* Small green tag */}
                    </span>
                    <strong className="conflict-suggestion-facility">    {/* Court name */}
                      {court?.name || facility.name}                 {/* Show the court name (or the main facility name) */}
                    </strong>
                    <span>{prettyDate(date)}</span>                  {/* The date in an easy-to-read format */}
                    <span className="conflict-suggestion-time">      {/* Time of the suggestion */}
                      {suggestion.start} – {suggestion.end}          {/* Start and end time */}
                    </span>
                    <span className="conflict-suggestion-label">     {/* Small note at the bottom */}
                      {suggestion.facilityId === facility.id         // Is it the same court as the user wanted?
                        ? 'Alternative time'                         // Yes: only the time is different
                        : 'Same time · another court'}               {/* No: same time, but on another court */}
                    </span>
                    <span className="conflict-radio" aria-hidden="true" />    {/* Round radio circle in the corner */}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="conflict-empty">                           {/* Message when there are no suggestions */}
              {loadError                                             // Did loading fail?
                ? 'Availability could not be loaded. Please return to the availability page and try again.'    // Yes: show the error message
                : 'No other slots are available on this date. Try another date or facility.'}                 {/* No: the day is just full */}
            </p>
          )}

          <div className="conflict-selection">                       {/* Bottom bar: chosen text + continue button */}
            <span>                                                   {/* Text that shows what is chosen */}
              {selected && selectedFacility                          // Is a suggestion chosen?
                ? `Selected: ${selectedFacility.name}, ${selected.start} – ${selected.end}`    // Yes: show the chosen court and time
                : 'Select an alternative slot to continue.'}         {/* No: ask the user to choose one */}
            </span>
            <Link                                                    // Link that works as the Continue button
              className={`conflict-continue${selected ? '' : ' disabled'}`}    // Add "disabled" style if nothing is chosen
              aria-disabled={!selected}                              // Tell screen readers it is disabled when nothing is chosen
              tabIndex={selected ? 0 : -1}                           // Allow keyboard focus only when something is chosen
              onClick={(event) => {                                  // When the link is clicked
                if (!selected) event.preventDefault();               // If nothing is chosen, stop the link from opening
              }}
              to={`/book?facility_id=${selected?.facilityId || facility.id}&date=${date}&start=${selected?.start || start}&end=${selected?.end || end}`}    // Go to the booking page with the chosen (or original) values
            >
              Continue with Alternative
              <span aria-hidden="true">→</span>                      {/* Arrow icon; hidden from screen readers */}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ConflictPanel;                                        // Export the panel so BookingForm can use it