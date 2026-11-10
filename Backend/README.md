# Backend guide

The backend is an Express API backed by PostgreSQL. The server entry point
registers middleware and route modules; route-specific request handling lives
under `src/routes/`.

## Source layout

| Path                               | Responsibility                                        |
| ---------------------------------- | ----------------------------------------------------- |
| `src/server.js`                    | Express app setup, middleware, and route registration |
| `src/routes/`                      | HTTP endpoints grouped by feature                     |
| `src/auth.js`                      | Request authentication and admin authorization        |
| `src/db.js`                        | Shared PostgreSQL connection pool                     |
| `src/db/schema.sql`                | Base database schema                                  |
| `src/db/seed.sql`                  | Initial facilities and booking-rule data              |
| `src/db/*.sql`                     | Feature migrations and database changes               |
| `src/time.js`, `src/timetable.js`  | Shared time, booking-window, and timetable rules      |
| `src/email.js`, `src/reminders.js` | Email delivery and scheduled reminders                |
| `tests/`                           | API and booking-rule regression tests                 |

## Database changes

Review the comments at the top of each SQL script before applying it. Some
scripts are migrations and some are intended for initial setup or seed data;
their ordering and re-run safety are not interchangeable. `src/db/run-sql.js`
can execute a SQL file using the configured database connection.

Paid-booking proof and late-review remedy tracking require the
`src/db/booking-payment-proof.sql` migration on existing databases:

```sh
node src/db/run-sql.js src/db/booking-payment-proof.sql
```

Paid pending bookings expire at their start time if an administrator has not
approved them. The user can choose a full refund or booking credit; the DSA
arranges the selected remedy outside the app and records when it is complete.

## Local checks

Start the API with `npm run dev` from this directory. The test scripts are
available as `npm run test:conflict`, `npm run test:rules`, `npm run test:admin`,
and `npm run test:all`.

## Code conventions

- Keep route-specific behavior in its matching route module and shared rules
  in the existing helper modules.
- Keep database queries parameterized and preserve transaction boundaries.
- Comment on constraints, rule decisions, and migration safety that are not
  apparent from the code; avoid narrating routine operations.
- Use the repository root `npm run format` and `npm run format:check` commands
  for consistent JavaScript and PostgreSQL SQL formatting.
