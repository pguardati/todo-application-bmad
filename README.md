# bmad-todo-application-typescript

A personal todo board: a FastAPI + SQLModel backend and a React + Vite client, wired through a
same-origin `/api` seam.

## Start

```sh
make install
make dev
```

The backend serves on <http://localhost:8000> and the client on <http://localhost:5173>, with
`/api/*` proxied to the backend.

## Make targets

| Target | What it does |
| --- | --- |
| `install` | Install backend, frontend and e2e dependencies |
| `dev` | Run the backend on 8000 and the Vite dev server on 5173 |
| `lint` | Ruff on the backend, TypeScript typecheck on the frontend |
| `test-backend` | pytest with the 70% line-coverage gate |
| `test-frontend` | Vitest |
| `test-e2e` | Playwright against the `test` compose profile |
| `test` | All three suites |
| `coverage` | Both coverage reports with their gates enforced |
| `db-reset` | Delete the local database file and the dev compose volume |
| `ci` | `lint` + `coverage` + `test-e2e` — what CI runs |

## Containers

One `docker-compose.yml` with two profiles:

- `dev` — bind mounts and hot reload, SQLite on a named volume.
- `test` — built images, nginx on 8080 proxying `/api`, ephemeral SQLite. `docker compose --profile test up --build`.

## Configuration

Every backend setting lives in `backend/app/config.py` and has a working local default. Copy
`.env.example` to `.env` to override; `.env` is git-ignored.
