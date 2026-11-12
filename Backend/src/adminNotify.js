// ----- imports -----
const pool = require('./db');                // Database connection pool
const { sendEmail } = require('./email');    // Our shared email sender

// ----- getAdminEmails: find who should get admin alerts -----
// ADMIN_NOTIFY_EMAIL wins if set, otherwise every admin user gets the mail
async function getAdminEmails() {                           // Gives back a list of emails
  const fromEnv = (process.env.ADMIN_NOTIFY_EMAIL || '')    // Text from .env, or empty text
    .split(',')                                             // Split many emails by comma
    .map((e) => e.trim())                                   // Remove spaces around each email
    .filter(Boolean);                                       // Remove empty ones
  if (fromEnv.length > 0) return fromEnv;                   // Use the .env list when it has emails
  const result = await pool.query(                          // Else read the admins from the database
    `SELECT email FROM users WHERE role = 'admin'`,         // Get the email of every admin
  );                                                        // End of the query
  return result.rows.map((row) => row.email);               // Give back only the email texts
}                                                           // End of getAdminEmails

// ----- notifyAdmins: send one mail to every admin (never throws) -----
// Runs after the booking or request is already saved, so a mail error must not break it
async function notifyAdmins({ subject, text }) {                           // Takes the mail title and body
  try {                                                                    // Catch every error below
    const emails = await getAdminEmails();                                 // Find who gets the mail
    if (emails.length === 0) {                                             // Nobody to tell
      console.warn('No admin email found, alert not sent:', subject);      // Show a warning
      return;            // Stop here
    }                    // End of if
    await Promise.all(                           // Send all mails at the same time
      emails.map((to) =>                         // Make one mail for each admin
         sendEmail({ to, subject, text })        // Send the mail to this admin
         .then(() => console.log(`Admin alert sent to ${to}: ${subject}`)) // Print a line when the mail was accepted
         .catch((error) =>                                                // Catch this mail's own error
           console.error(`Admin alert to ${to} failed:`, error.message),  // One bad mail will not stop the rest
          ),          // End of catch                                                                 // End of catch
      ),              // End of map
    );                // End of Promise.all
  } catch (error) {                                                        // Something else went wrong
    console.error('Could not send admin alert:', error);                   // Only log it
  }                   // End of try/catch
}                     // End of notifyAdmins

module.exports = { notifyAdmins };    // Let other files use notifyAdmins