# CST-SFBS

## Project layout

| Path             | Responsibility                                  |
| ---------------- | ----------------------------------------------- |
| `frontend/`      | React and Vite browser application              |
| `Backend/`       | Express API, PostgreSQL access, and SQL scripts |
| `Backend/tests/` | API and booking-rule regression tests           |

See [frontend/README.md](./frontend/README.md) and
[Backend/README.md](./Backend/README.md) for area-specific structure and
development guidance.

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
