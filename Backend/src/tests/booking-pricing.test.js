const { bookingPaymentAmount, requiresBookingPayment } = require('../bookingPricing');

describe('booking payment policy', () => {
  test('faculty commercial-rate bookings for other facilities are free', () => {
    expect(requiresBookingPayment('faculty', 'badminton', true)).toBe(false);
    expect(bookingPaymentAmount('badminton', 'faculty', '2026-11-17', false)).toBe(0);
  });

  test('faculty commercial football bookings remain chargeable', () => {
    expect(requiresBookingPayment('faculty', 'football', true)).toBe(true);
    expect(bookingPaymentAmount('football', 'faculty', '2026-11-17', false)).toBe(3500);
  });

  test('student commercial slots and outsider bookings retain their fees', () => {
    expect(requiresBookingPayment('student', 'badminton', true)).toBe(true);
    expect(bookingPaymentAmount('badminton', 'student', '2026-11-17', false)).toBe(1500);
    expect(requiresBookingPayment('outsider', 'badminton', false)).toBe(true);
    expect(bookingPaymentAmount('badminton', 'outsider', '2026-11-17', false)).toBe(1500);
  });
});
