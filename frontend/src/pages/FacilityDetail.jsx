// useEffect = run code when the page opens; useState = remember changing values
import { useEffect, useState } from 'react';

// useParams = read the value from the URL (/facilities/football -> "football")
// Link = clickable link that doesn't reload the page
import { useParams, Link } from 'react-router-dom';

// Descriptions text per sport (already exists in your project)
import { DESCRIPTIONS } from '../facilityMeta';

// The fake grid data from the file above
import { DAYS, TIME_SLOTS, SAMPLE_GRID } from '../facilityDetailMock';

// The styles for this page
import './FacilityDetail.css';

// Backend address, same as in Facilities.jsx
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function FacilityDetail() {
  // Get ":type" from the route path "/facilities/:type" in App.jsx
  const { type } = useParams();

  const [facility, setFacility] = useState(null);   // sport info: { name, courtCount }
  const [loading, setLoading] = useState(true);     // true while waiting for backend
  const [error, setError] = useState(null);         // error message if fetch fails
  const [selected, setSelected] = useState(null);   // clicked slot: { row, col } or null

  // Runs when the page opens, and again if "type" changes in the URL
  useEffect(() => {
    fetch(`${API_URL}/facilities`)                  // get all facilities from backend
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`); // bad reply = error
        return res.json();                          // convert reply to JS data
      })
      .then((data) => {
        // Keep only the rows for this sport (e.g. all "football" rows)
        const rows = data.filter((f) => f.type === type);
        if (rows.length > 0) {
          // Save the sport's name and how many courts it has
          setFacility({ name: rows[0].group_name, courtCount: rows.length });
        }
        setLoading(false);                          // stop "Loading…"
      })
      .catch((err) => {
        setError(err.message);                      // save error text to show
        setLoading(false);
      });
  }, [type]);

  // While loading, show a simple message and stop here
  if (loading) return <main className="fd-page"><p>Loading…</p></main>;

  // If the fetch failed OR this sport doesn't exist, show a message + back link
  if (error || !facility) {
    return (
      <main className="fd-page">
        <p>{error ? `Couldn't load facility (${error}).` : 'Facility not found.'}</p>
        <Link to="/facilities">Back to facilities</Link>
      </main>
    );
  }

  const isWithinSchedule = (row, col) => {
    const isWeekend = col >= 5;
    return isWeekend || row >= 5 || (type === 'football' && row === 0);
  };

  // Runs when someone clicks a grid cell. row = time slot index, col = day index
  const handleCellClick = (row, col) => {
    if (!isWithinSchedule(row, col) || SAMPLE_GRID[row][col] !== 'A') return;
    setSelected({ row, col });                      // remember the clicked cell
  };

  // Runs when someone clicks "Select Slot & Book"
  const handleBook = () => {
    // TODO: later, send a POST request to the backend here
    alert(`Booking: ${facility.name}, ${DAYS[selected.col].label}, ${TIME_SLOTS[selected.row]}`);
  };

  // What the page looks like (JSX). Comments inside here must use {/* */}
  return (
    <main className="fd-page">
      {/* LEFT COLUMN: facility info + rules */}
      <div className="fd-left">
        {/* White box with name, picture and description */}
        <div className="fd-card">
          <h2 className="fd-title">{facility.name}</h2>
          <img
            className="fd-img"
            src={`/images/${type}.jpg`}             // picture from public/images/
            alt={facility.name}
            onError={(e) => { e.target.style.visibility = 'hidden'; }} // hide if missing
          />
          <p className="fd-desc">{DESCRIPTIONS[type] || ''}</p>
        </div>

        {/* White box with "who can book on which day" */}
        <div className="fd-card">
          <h3 className="fd-subtitle">Day-Specific Allocation Rules</h3>
          {DAYS.map((d) => (                        // one line per day
            <div className="fd-rule" key={d.key}>
              <span>{d.label.split(' ')[0]}</span>  {/* "Mon (St.)" becomes "Mon" */}
              <span className="fd-rule-who">{d.who}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: the weekly grid */}
      <div className="fd-card fd-availability-card">
        {/* Title on the left, colour legend on the right */}
        <div className="fd-grid-head">
          <div>
            <h3 className="fd-grid-title">Weekly Availability Grid</h3>
            <p className="fd-muted">Select an open slot to begin your booking</p>
          </div>
          <div className="fd-legend">
            <span><i className="fd-dot fd-green" /> Available</span>
            <span><i className="fd-dot fd-red" /> Booked</span>
            <span><i className="fd-dot fd-gray" /> Unavailable</span>
            <span><i className="fd-dot fd-orange" /> Selected</span>
          </div>
        </div>

        <div className="fd-grid">
          {/* Header row: the word "Time" + the 7 day names */}
          <div className="fd-row">
            <div className="fd-muted">Time</div>
            {DAYS.map((d) => (
              <div className="fd-day" key={d.key}>{d.label}</div>
            ))}
          </div>

          {/* One row for each time slot. "row" = position in TIME_SLOTS */}
          {TIME_SLOTS.map((time, row) => (
            <div className="fd-row" key={time}>
              <div className="fd-time">{time}</div>  {/* time label on the left */}

              {/* One button per day. "col" = position in DAYS */}
              {DAYS.map((d, col) => {
                const cellStatus = SAMPLE_GRID[row][col];
                const isWithinFacilitySchedule = isWithinSchedule(row, col);
                const isBooked = cellStatus === 'B' && isWithinFacilitySchedule;
                const isUnavailable = cellStatus === 'U' || !isWithinFacilitySchedule;
                // Is this the cell the user clicked?
                const isSelected = selected && selected.row === row && selected.col === col;
                // Decide the look: selected > booked > unavailable > available
                const status = isSelected
                  ? 'selected'
                  : isBooked
                    ? 'booked'
                    : isUnavailable
                      ? 'unavailable'
                      : 'available';
                const label = isBooked ? 'Booked' : isUnavailable ? 'Unavailable' : 'Available';
                return (
                  <button
                    key={d.key}
                    className={`fd-cell fd-${status}`}
                    disabled={isBooked || isUnavailable}
                    onClick={() => handleCellClick(row, col)}
                  >
                    {isSelected ? 'Selected' : label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom bar: chosen slot text + the book button */}
        <div className="fd-footer">
          <div>
            <span className="fd-muted">Selected Slot:</span>
            <p className="fd-selected">
              {selected
                ? `${DAYS[selected.col].label}, ${TIME_SLOTS[selected.row]}` // e.g. "Wed (St.), 03:00 - 05:00 PM"
                : 'None'}                                                   {/* nothing clicked yet */}
            </p>
          </div>
          {/* Greyed out until a slot is selected */}
          <button className="fd-book" disabled={!selected} onClick={handleBook}>
            Select Slot &amp; Book
          </button>
        </div>
      </div>
    </main>
  );
}

// Lets App.jsx import this page
export default FacilityDetail;