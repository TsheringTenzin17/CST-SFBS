// ==============================================================
// IMPORTS - load the packages we need
// ==============================================================
const nodemailer = require('nodemailer');                   // package that sends mail by smtp

// ==============================================================
// SETTINGS - email links and wait time
// ==============================================================
const RESEND_API_URL = 'https://api.resend.com/emails';     // link for resend
// link for brevo
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 15000;                             // wait max 15 seconds

let gmailTransporter = null;                                // gmail connection, made later

// ==============================================================
// getGmailTransporter - make the gmail connection one time only
// ==============================================================
function getGmailTransporter() {                            // gives back the gmail connection
  if (!gmailTransporter) {                                  // not made yet
    gmailTransporter = nodemailer.createTransport({         // make the connection
      host: 'smtp.gmail.com',                               // gmail server
      port: 587,                                            // port for starttls
      secure: false,                                        // starts plain, then upgrades
      requireTLS: true,                                     // must upgrade to tls
      connectionTimeout: 10000,                             // wait 10 sec to connect
      greetingTimeout: 10000,                               // wait 10 sec for server hello
      socketTimeout: EMAIL_TIMEOUT_MS,                      // wait 15 sec if server is quiet
      auth: {                                               // login details
        user: process.env.GMAIL_USER,                       // gmail address from .env
        pass: process.env.GMAIL_APP_PASSWORD,               // app password from .env
      },                                                    // end of auth
    });                                                     // end of createTransport
  }                                                         // end of if
  return gmailTransporter;                                  // give back the connection
}                                                           // end of function

// ==============================================================
// sendWithGmail - send one email using gmail
// ==============================================================
async function sendWithGmail({ to, subject, text }) {       // takes to, subject, text
  await getGmailTransporter().sendMail({                    // send the mail
    from: `"CST-SFBS" <${process.env.GMAIL_USER}>`,         // sender name and address
    to,                                                     // who gets the mail
    subject,                                                // mail title
    text,                                                   // mail body
  });                                                       // end of sendMail
}                                                           // end of function

// ==============================================================
// isEmailConfigured - check if any email service is set up
// ==============================================================
function isEmailConfigured() {                              // gives back true or false
  return Boolean(                                           // turn the result into true or false
    (process.env.BREVO_API_KEY && process.env.BREVO_SENDER) ||          // brevo is set
    (process.env.RESEND_API_KEY && process.env.RESEND_FROM) ||          // or resend is set
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),         // or gmail is set
  );                                                        // end of Boolean
}                                                           // end of function

// ==============================================================
// postJson - send a json post request with a time limit
// ==============================================================
async function postJson(url, headers, body, providerName) { // used by brevo and resend
  // ----------------------------------------------------------
  // set up the time limit
  // ----------------------------------------------------------
  const controller = new AbortController();                 // lets us cancel the request
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);  // cancel after 15 sec

  // ----------------------------------------------------------
  // send the request
  // ----------------------------------------------------------
  try {                                                     // catch errors
    const response = await fetch(url, {                     // send the request
      method: 'POST',                                       // we are sending data
      headers: { 'Content-Type': 'application/json', ...headers },  // json plus extra headers
      body: JSON.stringify(body),                           // turn data into json text
      signal: controller.signal,                            // so we can cancel it
    });                                                     // end of fetch
    if (!response.ok) {                                     // server said no
      const detail = await response.text();                 // read the error text
      // throw an error with the service name, code and detail
      throw new Error(`${providerName} rejected the message (${response.status}): ${detail}`);
    }                                                       // end of if
  } catch (error) {                                         // something went wrong
    // if we cancelled it, it was too slow
    if (controller.signal.aborted) throw new Error(`${providerName} request timed out.`);
    throw error;                                            // any other error, pass it on
  } finally {                                               // always runs at the end
    clearTimeout(timeout);                                  // stop the timer
  }                                                         // end of try
}                                                           // end of function

// ==============================================================
// sendWithResend - send one email using resend
// ==============================================================
function sendWithResend({ to, subject, text }) {            // takes to, subject, text
  return postJson(                                          // use the shared post function
    RESEND_API_URL,                                         // resend link
    { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },  // key from .env
    { from: process.env.RESEND_FROM, to: [to], subject, text }, // the mail data
    'Resend',                                               // name used in error text
  );                                                        // end of postJson
}                                                           // end of function

// ==============================================================
// sendWithBrevo - send one email using brevo
// ==============================================================
function sendWithBrevo({ to, subject, text }) {             // takes to, subject, text
  return postJson(                                          // use the shared post function
    BREVO_API_URL,                                          // brevo link
    { 'api-key': process.env.BREVO_API_KEY },               // key from .env
    {                                                       // the mail data
      sender: { name: 'CST-SFBS', email: process.env.BREVO_SENDER },  // who sends it
      to: [{ email: to }],                                  // who gets it
      subject,                                              // mail title
      textContent: text,                                    // mail body
    },                                                      // end of mail data
    'Brevo',                                                // name used in error text
  );                                                        // end of postJson
}                                                           // end of function

// ==============================================================
// sendEmail - pick the first email service that is set up
// ==============================================================
async function sendEmail({ to, subject, text }) {           // main function other files use
  // ----------------------------------------------------------
  // try brevo first, then resend, then gmail
  // ----------------------------------------------------------
  if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER) {  // brevo is set
    return sendWithBrevo({ to, subject, text });            // send with brevo
  }                                                         // end of if
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {  // resend is set
    return sendWithResend({ to, subject, text });           // send with resend
  }                                                         // end of if
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {  // gmail is set
    return sendWithGmail({ to, subject, text });            // send with gmail
  }                                                         // end of if

  // ----------------------------------------------------------
  // nothing is set up
  // ----------------------------------------------------------
  // tell what to add in .env
  throw new Error(
    'Email is not configured. Set BREVO_API_KEY and BREVO_SENDER (or RESEND_API_KEY and RESEND_FROM, or GMAIL_USER and GMAIL_APP_PASSWORD).',
  );
}                                                           // end of function

// ==============================================================
// EXPORT - let other files use these functions
// ==============================================================
module.exports = { isEmailConfigured, sendEmail };          // share the functions