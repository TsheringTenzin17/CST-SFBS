# Frontend guide

The frontend is a React single-page application built with Vite. Its source is
organized by responsibility so feature code stays near the page or component
that owns it.

## Source layout

| Path                  | Responsibility                                                 |
| --------------------- | -------------------------------------------------------------- |
| `src/main.jsx`        | Browser entry point and top-level providers                    |
| `src/App.jsx`         | Route definitions, access guards, and shared page chrome       |
| `src/pages/`          | Route-level screens and their page-specific styles             |
| `src/components/`     | Shared interface elements used by multiple screens             |
| `src/hooks/`          | Reusable stateful React behavior                               |
| `src/utils/`          | API access, date/time, availability, and formatting helpers    |
| `src/AuthContext.jsx` | Shared signed-in user and session actions                      |
| `src/index.css`       | Global tokens, base styles, and shared layout/responsive rules |
| `src/auth.css`        | Shared presentation for sign-in and registration screens       |

## Local setup

Run these commands from the `frontend` directory:

```powershell
npm install
Copy-Item .env.example .env.local
```

`VITE_API_URL` in `.env.local` should point to the running backend. It defaults
to `http://localhost:4000` when unset. Start the development server with:

```powershell
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`. Run the backend in
a separate terminal; see [Backend/README.md](../Backend/README.md) for database
setup and API configuration. Never put backend credentials or email-provider
secrets in frontend environment variables.

## Main user flows

- Visitors and signed-in users can browse facilities, inspect role-eligible
  slots, and submit support requests.
- Students, faculty, and outsiders see booking options that follow their role
  and facility rules. Booking dates are limited to today through the next six
  days.
- Students see campus restriction reasons on affected dates and cannot book,
  reschedule, or rebook into those dates. Faculty and outsiders are not blocked
  by student-only restrictions.
- Administrators manage bookings, facilities, maintenance, tournaments,
  student booking restrictions, and support requests.
- In the admin support inbox, resolved requests can be permanently removed;
  unresolved requests cannot be deleted.

## How a page is rendered

`index.html` provides the `#root` mount point and loads `src/main.jsx`.
`main.jsx` mounts `App` inside the router and authentication provider. `App`
selects a route and applies the client, authentication, or admin access guard.
Page-specific styles are imported by their owning page or component; keep new
feature styles scoped to that feature instead of adding them to global CSS.

## Shared behavior

- Use `useAuth()` for the current user and session actions.
- Use `apiCall()` from `src/utils/api.js` for requests to the backend.
- Keep slot, availability, and display-formatting logic in the matching
  `src/utils/` helper so pages share the same rules.
- Use `src/components/` for UI that has more than one caller; keep one-off UI
  with its page.

## Style and comment conventions

- Keep page and component styles in the adjacent CSS file and prefix selectors
  with the feature's root class where practical.
- Use `index.css` only for global foundations and genuinely shared behavior.
  When changing global or responsive rules, check whether a page stylesheet
  intentionally overrides them.
- Group imports, component state/effects, event handlers, and rendered sections
  consistently within a module.
- Add comments for non-obvious decisions, constraints, or data flow; avoid
  comments that merely repeat what the code already says.
- Preserve existing route paths, CSS class names, and API behavior when
  reorganizing code.

## Local checks

Build the production frontend from this directory:

```powershell
npm run build
```

The generated site is written to `dist/`.
