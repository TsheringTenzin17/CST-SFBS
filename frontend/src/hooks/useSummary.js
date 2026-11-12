// =============================================================
// frontend/src/hooks/useSummary.js  —  load today's real slot counts
// =============================================================
// const { summary, loading } = useSummary('2026-10-20');
// summary is { 'Badminton Court': { available, total, blocked }, ... }

// ----- Imports -----
import { useEffect, useState } from 'react';             // Import useEffect (run code) and useState (store data)
import { apiCall } from '../utils/api';                  // Import the helper that talks to the backend
import { groupSummary } from '../utils/availability';    // Import the helper that groups the facility data

// ----- Hook: useSummary -----
// Loads the slot counts for one date and returns them with a loading flag
export default function useSummary(date) {         // Custom hook; "date" is the day we want to load
  const [summary, setSummary] = useState({});      // summary = the loaded data (starts empty)
  const [loading, setLoading] = useState(true);    // loading = true while waiting for the answer

  // ---------- Effect: fetch the data whenever the date changes ----------
  useEffect(() => {                                   // Run this code when the component shows or "date" changes
    let cancelled = false;                            // Flag: ignore the answer if the page was left meanwhile
    setLoading(true);                                 // Show the loading state before we start
    apiCall(`/facilities/summary?date=${date}`)       // Ask the backend for this date's summary
      .then((data) => {                               // When the answer arrives successfully
        if (!cancelled) setSummary(groupSummary(data.facilities));    // If still on the page, group the facilities and save them
      })                                              // End of the success handler
      .catch(() => {                                  // If the request fails
        if (!cancelled) setSummary({});               // If still on the page, reset the summary to empty
      })                                              // End of the error handler
      .finally(() => {                                // Runs after success or failure
        if (!cancelled) setLoading(false);            // If still on the page, stop showing loading
      });                                             // End of the finally handler and the whole request chain
    return () => {                                    // Cleanup: runs when the page is left or "date" changes
      cancelled = true;                               // Mark as cancelled so old answers are ignored
    };                                                // End of the cleanup function
  }, [date]);                                         // Run this effect again only when "date" changes

  return { summary, loading };    // Give the data and the loading flag to the component using this hook
}                                 // End of the useSummary hook