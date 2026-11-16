# CST-SFBS

CST-SFBS is the College of Science and Technology Sports Facility Booking
System. It provides a public facility browser, role-aware booking flows, and
administrative tools for campus facility operations.

## What the system includes

- Facility schedules and slot availability for students, faculty, and outsiders.
- Booking, payment review, reminders, cancellation, rescheduling, and booking
  history.
- Admin tools for managing bookings, facilities, maintenance, and tournaments.
- Student-only campus date restrictions for exams, tests, and other events.
  Restrictions may cover one date or a range, apply across facilities, and do
  not cancel bookings that already exist.
- Public support requests and an admin inbox for reviewing and resolving them.
  Admins can permanently remove a request after it is resolved.

## Project layout

| Path                 | Responsibility                                  |
| -------------------- | ----------------------------------------------- |
| `frontend/`          | React and Vite browser application              |
| `Backend/`           | Express API, PostgreSQL access, and SQL scripts |
| `Backend/src/tests/` | API and booking-rule regression tests           |

See [frontend/README.md](./frontend/README.md) and
[Backend/README.md](./Backend/README.md) for area-specific structure and
development guidance.

## Local development

The project requires Node.js and PostgreSQL. Configure the database and backend
environment before starting the frontend. The backend reads its settings from
`Backend/.env`; the browser application uses `frontend/.env.local`.

For a new local database, start in the repository root and run these commands
in the first terminal:

```powershell
Set-Location Backend
npm install
Copy-Item .env.example .env
# Set DATABASE_URL and SESSION_SECRET in .env; use DB_SSL=false for local PostgreSQL.
node src\db\run-sql.js src\db\schema.sql
node src\db\run-sql.js src\db\seed.sql
npm run dev
```

In a second terminal, start the frontend:

```powershell
Set-Location frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

The frontend defaults to `http://localhost:5173` and the API to
`http://localhost:4000`. For an existing database, do not rerun the base schema
or seed data; follow the migration instructions in
[Backend/README.md](./Backend/README.md).

## Checks

Build the frontend from the repository root with:

```powershell
npm --prefix frontend run build
```

Backend integration tests need a running API and a dedicated test database.
See [Backend/README.md](./Backend/README.md) for test commands. Check formatting
from the repository root with `npm run format:check`.

## Code style

Application source files use the repository's Prettier configuration. To format
the frontend, backend, and SQL source files, run:

```powershell
npm run format
```

To check formatting without changing files, run:

```powershell
npm run format:check
```

Generated bundles, dependencies, environment files, and lockfiles are excluded
from formatting. Add comments for non-obvious behavior and constraints rather
than narrating straightforward code.
