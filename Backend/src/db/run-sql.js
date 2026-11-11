// RUN SQL WITHOUT INSTALLING psql
// run a sql file: node src/db/run-sql.js src/db/booking-hardening.sql
// run one statement: node src/db/run-sql.js --sql "SELECT COUNT(*) FROM users"

require('dotenv').config();                                             // load the settings from the .env file
const fs = require('fs');                                               // tool to read files
const pool = require('../db');                                          // database connection pool

const args = process.argv.slice(2);                                     // get the words typed after the file name
const sql = args[0] === '--sql' ? args[1] : args[0] ? fs.readFileSync(args[0], 'utf8') : null;   // if --sql, use the typed statement, else read the file, else null

if (!sql) {                                                             // if no sql was given
  console.error(                                                        // show an error message
    'Usage: node src/db/run-sql.js <file.sql>   OR   node src/db/run-sql.js --sql "<statement>"',   // tell the user how to run this file
  );                                                                    // end of the error message
  process.exit(1);                                                      // stop the program, 1 means error
}                                                                       // end of the if

pool                                                                    // use the database connection
  .query(sql)                                                           // run the sql
  .then((result) => {                                                   // when the sql finishes well
    const last = Array.isArray(result) ? result[result.length - 1] : result;   // if many commands were run, take the last result
    if (last && last.rows && last.rows.length > 0) console.table(last.rows);   // if there are rows, show them in a table
    if (last && last.command && last.command !== 'SELECT' && last.rowCount != null)   // if it was not a SELECT and has a row count
      console.log(`${last.command}: ${last.rowCount} row(s) affected`); // show the command name and how many rows changed
    console.log('Done.');                                               // tell the user it is finished
  })                                                                    // end of the success part
  .catch((err) => console.error('Failed:', err.message))                // if something goes wrong, show the error message
  .finally(() => pool.end());                                           // always close the database connection at the end