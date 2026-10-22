// =============================================================
// frontend/src/facilityMeta.js  —  text that is not in the database
// =============================================================
// Only descriptions live here now. The "Available today" badges and the
// "x of y slots free" numbers come from the backend (utils/availability.js),
// so they are always real.
export const DESCRIPTIONS = {
  football: 'Premium artificial turf pitch featuring professional LED floodlights & standard spectator stands.',
  basketball: '1 indoor court with high quality synthetic maple flooring, and adjustable hoops.',
  volleyball: '2 outdoor courts (one male, one female), sand-filled and equipped with high-intensity night lighting and easily adjustable net height.',
  badminton: '2 indoor wooden courts equipped with professional non-glare tournament grade nets and lighting.',
  table_tennis: '2 professional-grade indoor tables with rubberized non-slip mat flooring and dedicated umpire stands.',
  archery: 'Authentic Bhutanese traditional and Olympic-grade compound archery range reaching standard long distances.',
};

export const IMAGES = {
  football: '/images/fg.jpeg',
  basketball: '/images/bb.jpeg',
  volleyball: '/images/volleyball.jpeg',
  badminton: '/images/bmt.jpeg',
  table_tennis: '/images/tt.jpeg',
  archery: '/images/archery.jpeg',
};
