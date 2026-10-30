// =============================================================
// Backend/src/server.js  —  app entry point
// =============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// FRONTEND_URL (set on Render) limits which website may call this API.
// Development can be permissive; production must provide an explicit allowlist.
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be configured in production.');
}
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : (allowedOrigins.length > 0 ? allowedOrigins : true),
}));
app.use(express.json({ limit: '2mb' })); // facility photos arrive as compressed data URLs

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', require('./routes/auth'));
app.use('/facilities', require('./routes/facilities'));
app.use('/bookings', require('./routes/bookings'));
app.use('/notifications', require('./routes/notifications'));
app.use('/support', require('./routes/support'));
app.use('/maintenance', require('./routes/maintenance'));
app.use('/tournaments', require('./routes/tournaments'));
app.use('/admin/facilities', require('./routes/adminFacilities'));
app.use('/admin/settings', require('./routes/adminSettings'));
app.use('/admin', require('./routes/admin'));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CST-SFBS backend running on port ${PORT}`);
    require('./reminders').startReminderScheduler();
  });
}
module.exports = app;