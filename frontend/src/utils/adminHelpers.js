export const CHART_COLORS = ['#255463', '#24a148', '#f59e0b', '#8b5cf6', '#ef4444', '#06a6a6'];

export function formatDate(value) {
  return String(value || '').slice(0, 10) || '—';
}

export function formatTime(value) {
  return String(value || '').slice(0, 5) || '—';
}

// Bookings per facility for the last 7 days (cancelled ones are ignored)
export function getUsageRows(bookingList) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);

  const counts = {};
  bookingList.forEach((booking) => {
    const date = new Date(`${booking.booking_date}T00:00:00`);
    if (
      booking.status !== 'cancelled' &&
      booking.facility_name &&
      !Number.isNaN(date.getTime()) &&
      date >= weekStart &&
      date <= today
    ) {
      counts[booking.facility_name] = (counts[booking.facility_name] || 0) + 1;
    }
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}