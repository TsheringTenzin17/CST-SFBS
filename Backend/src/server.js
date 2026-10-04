require('dotenv').config();
const express = require('express');
const cors = require('cors');

const facilitiesRouter = require('./routes/facilities');
const bookingsRouter = require('./routes/bookings');
const authRouter = require('./routes/auth');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/facilities', facilitiesRouter);
app.use('/bookings', bookingsRouter);
app.use('/auth', authRouter);

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`CST-SFBS backend running on port ${PORT}`));
}
module.exports = app;