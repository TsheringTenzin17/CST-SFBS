// =============================================================
// Backend/src/server.js  —  app entry point
// =============================================================

// ==============================================================
// IMPORTS - load the packages and helper files we need
// ==============================================================
require('dotenv').config();                                 // load the .env file
const express = require('express');                         // web framework
const cors = require('cors');                               // lets the website call this api
const { isEmailConfigured } = require('./email');           // checks if email is set up

const app = express();                                      // make the app

// ==============================================================
// CORS - decide which websites can call this api
// ==============================================================
// FRONTEND_URL (set on Render) limits which website may call this API.
// Development can be permissive; production must provide an explicit allowlist.
// ----------------------------------------------------------
// check the frontend link in production
// ----------------------------------------------------------
// in production the link must be set, else stop
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL must be configured in production.');  // stop the server
}                                                           // end of if
// ----------------------------------------------------------
// make the list of allowed websites
// ----------------------------------------------------------
const allowedOrigins = (process.env.FRONTEND_URL || '')     // link text from .env, or empty
  .split(',')                                               // split many links by comma
  .map((origin) => origin.trim().replace(/\/+$/, ''))       // remove spaces and end slashes
  .filter(Boolean);                                         // remove empty ones
// ----------------------------------------------------------
// turn on cors
// ----------------------------------------------------------
app.use(                                                    // use cors on every route
  cors({                                                    // cors settings
    origin:                                                 // which websites are allowed
      process.env.NODE_ENV === 'production'                 // are we in production
        ? allowedOrigins                                    // production uses the list only
        : allowedOrigins.length > 0                         // in development, is the list filled
          ? allowedOrigins                                  // use the list if it has links
          : true,                                           // else allow every website
  }),                                                       // end of cors
);                                                          // end of use

// ==============================================================
// MIDDLEWARE - read json from the request body
// ==============================================================
// compressed facility photos and booking payment screenshots
app.use(express.json({ limit: '3mb' }));                    // allow body up to 3 mb

// ==============================================================
// HEALTH - simple check that the server is alive
// ==============================================================
app.get('/health', (req, res) => res.json({ status: 'ok' }));  // reply with ok

// ==============================================================
// ROUTES - connect each route file to its path
// ==============================================================
app.use('/auth', require('./routes/auth'));                 // login and register
app.use('/facilities', require('./routes/facilities'));     // facilities list
app.use('/bookings', require('./routes/bookings'));         // bookings
app.use('/notifications', require('./routes/notifications'));  // user notifications
app.use('/support', require('./routes/support'));           // contact requests
app.use('/maintenance', require('./routes/maintenance'));   // maintenance blocks
app.use('/tournaments', require('./routes/tournaments'));   // tournament periods
app.use('/admin/facilities', require('./routes/adminFacilities'));  // admin facility tools
app.use('/admin/settings', require('./routes/adminSettings'));      // admin settings
app.use('/admin', require('./routes/admin'));               // other admin routes, keep last

// ==============================================================
// START - open the port and start the scheduler
// ==============================================================
const PORT = process.env.PORT || 4000;                      // port from .env, or 4000
// only start when this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {                                  // start listening
    console.log(`CST-SFBS backend running on port ${PORT}`);  // tell the port
    if (!isEmailConfigured()) {                             // no email service set up
      console.warn(                                         // show a warning
        'Email notifications are disabled: configure a supported email provider in the backend environment.',
      );                                                    // end of warn
    }                                                       // end of if
    require('./reminders').startReminderScheduler();        // start the reminder timer
  });                                                       // end of listen
}                                                           // end of if

// ==============================================================
// EXPORT - let other files use the app
// ==============================================================
module.exports = app;                                       // share the app