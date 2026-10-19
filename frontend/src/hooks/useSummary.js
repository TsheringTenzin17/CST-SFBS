// =============================================================
// frontend/src/hooks/useSummary.js  —  load today's real slot counts
// =============================================================
// const { summary, loading } = useSummary('2026-10-20');
// summary is { 'Badminton Court': { available, total, blocked }, ... }
import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { groupSummary } from '../utils/availability';

export default function useSummary(date) {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false; // ignore the answer if the page was left meanwhile
    setLoading(true);
    apiCall(`/facilities/summary?date=${date}`)
      .then((data) => { if (!cancelled) setSummary(groupSummary(data.facilities)); })
      .catch(() => { if (!cancelled) setSummary({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  return { summary, loading };
}