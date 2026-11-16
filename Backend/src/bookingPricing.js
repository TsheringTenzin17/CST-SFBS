const { dayOfWeek } = require('./time');

const NON_FOOTBALL_COMMERCIAL_FEE = 1500;

function bookingPaymentAmount(facilityType, role, bookingDate, assistantReferees) {
  if (facilityType !== 'football') {
    return role === 'faculty' ? 0 : NON_FOOTBALL_COMMERCIAL_FEE;
  }
  const weekend = [0, 6].includes(dayOfWeek(bookingDate));
  if (assistantReferees) return role === 'student' ? 2900 : weekend ? 4400 : 3900;
  return role === 'student' ? 2500 : weekend ? 4000 : 3500;
}

function requiresBookingPayment(role, facilityType, commercialSlot) {
  return (
    role === 'outsider' ||
    (commercialSlot && (role !== 'faculty' || facilityType === 'football'))
  );
}

module.exports = { bookingPaymentAmount, requiresBookingPayment };
