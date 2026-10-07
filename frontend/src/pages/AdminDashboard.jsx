// Import two React tools: useState stores data, useEffect runs code when the page opens
import { useEffect, useState } from 'react';

// The backend address. Uses the VITE_API_URL setting if it exists, otherwise your local backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// TEMPORARY: there's no login yet, so we pretend user 1 is the logged-in admin
const ADMIN_USER_ID = 1; // this user must have role = 'admin' in the database

// Start of the page component (a function that returns what to show on screen)
function AdminDashboard() {
  // bookings holds the list from the backend; setBookings updates it. Starts as an empty list
  const [bookings, setBookings] = useState([]);
  // loading is true until the data arrives, so we can show "Loading…"
  const [loading, setLoading] = useState(true);

  // Function that fetches all bookings from the backend
  function loadBookings() {
    fetch(`${API_URL}/bookings`)
      .then((res) => res.json())
      .then((data) => {
        setBookings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  // Run loadBookings once when the page first opens (the [] means "only once")
  useEffect(loadBookings, []);

  // Runs when you click Cancel on a booking. id is that booking's id
  async function handleCancel(id) {
    // Pop up a box asking for a reason
    const reason = window.prompt('Reason for cancelling this booking?');
    // If the admin pressed Cancel in the popup, stop and do nothing
    if (reason === null) return;
    // Send a PATCH request to update this booking
    await fetch(`${API_URL}/bookings/${id}`, {
      method: 'PATCH',                                       // PATCH means "change part of this item"
      headers: { 'Content-Type': 'application/json' },       // tell the backend we're sending JSON
      body: JSON.stringify({                                 // the data we send:
        status: 'cancelled',                                 //   new status
        admin_user_id: ADMIN_USER_ID,                        //   who is cancelling it
        reason,                                              //   why (what was typed in the popup)
      }),
    });
    loadBookings(); // reload the list so the table shows the updated status
  }

  // What the page displays
  return (
    <main className="main">
      <h1 className="title">Manage Facility Bookings</h1>

      {/* Show "Loading…" only while loading is true */}
      {loading && <p>Loading…</p>}

      <table className="availability-table">
        <thead>
          <tr>
            {/* The column headings. The last empty one is for the Cancel button */}
            <th>ID</th><th>Requester</th><th>Facility</th><th>Date</th><th>Time</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {/* Loop over every booking (b) and make one table row for each */}
          {bookings.map((b) => (
            <tr key={b.id}>                                  {/* key helps React tell rows apart */}
              <td>{b.id}</td>                                {/* booking number */}
              <td>{b.user_name} ({b.user_role})</td>         {/* who booked, and their role */}
              <td>{b.facility_name}</td>                     {/* which facility */}
              <td>{new Date(b.booking_date).toLocaleDateString()}</td>                     {/* the date */}
              <td>{b.start_time}-{b.end_time}</td>           {/* start and end time */}
              <td>
                {/* Green badge if approved, red otherwise */}
                <span className={`badge badge-${b.status === 'approved' ? 'green' : 'red'}`}>
                  {b.status}
                </span>
              </td>
              <td>
                {/* Show the Cancel button only for approved bookings */}
                {b.status === 'approved' && (
                  <button className="btn-primary" onClick={() => handleCancel(b.id)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

// Make this component available so App.jsx can import it
export default AdminDashboard;