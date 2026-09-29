// Placeholder display data not yet coming from the backend.
// Once the availability-grid page is built, replace STATUS and SLOTS
// with real values computed from GET /facilities/:id/availability
// for today's date, instead of these hardcoded guesses.

export const DESCRIPTIONS = {
  football: 'Premium artificial turf pitch featuring professional LED floodlights & standard spectator stands.',
  basketball: '1 indoor court with high quality synthetic maple flooring, and adjustable hoops.',
  volleyball: '2 outdoor courts (one male, one female), sand-filled and equipped with high-intensity night lighting and easily adjustable net height.',
  badminton: '2 indoor wooden courts equipped with professional non-glare tournament grade nets and lighting.',
  table_tennis: '2 professional-grade indoor tables with rubberized non-slip mat flooring and dedicated umpire stands.',
  archery: 'Authentic Bhutanese traditional and Olympic-grade compound archery range reaching standard long distances.',
};

export const STATUS = {
  football: { label: 'Available Today', variant: 'green' },
  basketball: { label: 'Reserved for Faculty', variant: 'blue' },
  volleyball: { label: 'Available Today', variant: 'green' },
  badminton: { label: 'Fully Booked', variant: 'red' },
  table_tennis: { label: 'Available Today', variant: 'green' },
  archery: { label: 'Traditional Mode', variant: 'orange' },
};

export const SLOTS_TEXT = {
  football: '12 Slots Available',
  basketball: '4 Slots Left',
  volleyball: '8 Slots Available',
  badminton: '0 Slots Available',
  table_tennis: '15 Slots Available',
  archery: '6 Slots Available',
};