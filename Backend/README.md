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

Database connections use TLS with server-certificate validation by default.
If the database uses a private CA, set `DB_SSL_CA` to its PEM certificate.
Only set `DB_SSL=false` for local PostgreSQL instances that do not support TLS.
SSL settings in `DATABASE_URL` are ignored so they cannot override these
verification settings.

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
