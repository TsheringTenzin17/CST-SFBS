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

// '16:00' -> '4 PM', '09:30' -> '9:30 AM'
export function clock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

// '2026-10-22' -> '22 Oct'
export function shortDay(dateStr) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

// 'table_tennis' -> 'Table Tennis'
export function sportName(type = '') {
  return String(type).split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
