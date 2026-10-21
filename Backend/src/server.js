// =============================================================
// Backend/src/server.js  —  app entry point
// =============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// FRONTEND_URL (set on Render) limits which website may call this API.
// Left empty during development = allow every origin.
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', require('./routes/auth'));
app.use('/facilities', require('./routes/facilities'));
app.use('/bookings', require('./routes/bookings'));
app.use('/notifications', require('./routes/notifications'));
app.use('/support', require('./routes/support'));
app.use('/maintenance', require('./routes/maintenance'));
app.use('/admin', require('./routes/admin'));

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`CST-SFBS backend running on port ${PORT}`));
}
module.exports = app;