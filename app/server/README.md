# QuizNGO Studio API server

Flask + SQLite backend for the web editor in [`app/`](../). Stores users, sessions, quiz documents and uploaded images.

- Port: `5020` (override with `APP_PORT`)
- Data: `data/quizngo_app.db` and `data/assets/` (gitignored)
- Auth: pluggable providers in [`auth/providers.py`](auth/providers.py). `dev` (default) trusts the submitted email/name; `oidc` is a placeholder for organization SSO.

## Run

```bash
./install.sh     # creates .venv and installs requirements
./start.sh       # python server.py --port 5020
curl http://127.0.0.1:5020/api/health
```

## API

All responses follow the repo contract: `{ "status": "success", ... }` or `{ "status": "error", "message": "..." }`.
Authenticated routes expect `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | |
| POST | `/api/auth/login` | `{email, name}` → `{token, user}` |
| GET | `/api/auth/me` | |
| POST | `/api/auth/logout` | |
| GET | `/api/quizzes` | list metadata (+ `cover` = first slide) |
| POST | `/api/quizzes` | `{title, data}` |
| GET | `/api/quizzes/{id}` | full document |
| PUT | `/api/quizzes/{id}` | `{title?, data?, revision, force?}`; `409` on revision mismatch (body includes current `quiz`) |
| DELETE | `/api/quizzes/{id}` | soft delete |
| POST | `/api/quizzes/{id}/duplicate` | |
| POST | `/api/assets` | multipart `file` (png/jpg/gif/webp/svg, ≤10MB) |
| GET | `/api/assets/{id}` | public, immutable cache |

The full specification lives in [`../SPEC.md`](../SPEC.md).
