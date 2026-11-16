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
| `src/tests/`                       | API and booking-rule regression tests                 |

## Local setup

Run these commands from the `Backend` directory:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` before starting the API:

- Set `DATABASE_URL` to the PostgreSQL connection string. For local PostgreSQL
  without SSL, set `DB_SSL=false`.
- Set a long, random `SESSION_SECRET`.
- Set `FRONTEND_URL` to the frontend origin, normally
  `http://localhost:5173`.
- Email delivery is optional in development. Configure one supported provider
  in the environment when email notifications are needed.

For a new database, create the base tables and then load the initial facilities
and booking rules:

```powershell
node src\db\run-sql.js src\db\schema.sql
node src\db\run-sql.js src\db\seed.sql
```

Run the API from this directory with `npm run dev`. The health check is
`GET http://localhost:4000/health`.

## Database changes

Review the comments at the top of each SQL script before applying it. Some
scripts are migrations and some are intended for initial setup or seed data;
their ordering and re-run safety are not interchangeable. `src/db/run-sql.js`
executes a SQL file using `DATABASE_URL`. Do not rerun the base schema or seed
against an existing database; apply only the feature migrations it needs.

For existing databases, apply the relevant migration from the `Backend`
directory. For example:

```powershell
node src\db\run-sql.js src\db\booking-payment-proof.sql
node src\db\run-sql.js src\db\booking-blackout-dates.sql
```

Before running M13 or deploying the bcrypt-only authentication code, back up
the database and run this one-time, repeatable migration from the `Backend`
directory:

```powershell
npm run migrate:password-hashes
```

It bcrypt-hashes legacy plaintext values in `users.password_hash`, preserves
already-valid bcrypt hashes, and verifies all user rows before committing.
User passwords remain unchanged. The migration is transactional and does not
print password values.

The payment migration adds payment-proof and late-review remedy tracking. The
blackout migration enables administrators to block student bookings across all
facilities for a date or range. These restrictions do not cancel existing
bookings and do not block faculty or outsider bookings. The support request
table is included in `schema.sql`; use `src/db/support-requests.sql` only when
an older database does not yet have that table.

The support inbox is available through the admin API. Administrators can list
and update requests, send a resolution email, and permanently delete a request
only after it is marked `resolved`. Deletion is restricted to administrators.

Paid pending bookings expire at their start time if an administrator has not
approved them, and the user is notified to choose a full refund or booking
credit. Refunds are handled by the DSA; an administrator can use a requested
credit to book a replacement slot agreed with the user. Replacement bookings
follow the same availability and eligibility rules as regular bookings, and
all bookings are limited to today through the next six days.

## API overview

The Express routes are mounted in `src/server.js`. Common route groups are:

| Route | Purpose |
| ----- | ------- |
| `GET /health` | Check whether the API is running |
| `/auth` | Registration, sign-in, profile, and account settings |
| `/facilities` | Facility list, date summaries, and slot availability |
| `/bookings` | Create, review, cancel, and reschedule bookings |
| `POST /support/requests` | Submit a support request; authentication is optional |
| `/admin/support-requests` | Admin inbox, status changes, and resolution email |
| `DELETE /admin/support-requests/:id` | Permanently remove a resolved request; admin only |
| `/booking-blackouts` | List restrictions; admins can create, edit, and remove them |
| `/maintenance`, `/tournaments` | Facility maintenance and tournament schedules |

Admin routes require an authenticated administrator. The delete endpoint
returns a conflict if a support request has not been resolved.

## Local checks

The integration tests require a running API and a dedicated test database.
Start the API in one terminal, then run the test suite from this directory:

```powershell
npm run test:all
```

Individual test files can be run with `node src\tests\conflict-test.js`,
`node src\tests\rules-test.js`, or `node src\tests\admin-test.js`.

## Code conventions

- Keep route-specific behavior in its matching route module and shared rules
  in the existing helper modules.
- Keep database queries parameterized and preserve transaction boundaries.
- Comment on constraints, rule decisions, and migration safety that are not
  apparent from the code; avoid narrating routine operations.
- Use the repository root `npm run format` and `npm run format:check` commands
  for consistent JavaScript and PostgreSQL SQL formatting.
