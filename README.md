# bmad-todo-application-typescript

A personal todo board: a FastAPI + SQLModel backend and a React + Vite client, wired through a
same-origin `/api` seam.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| [uv](https://docs.astral.sh/uv/) | 0.12.x | Backend dependencies and the pinned Python 3.13 (`make install`, `make test-backend`) |
| Node.js | 24 LTS | Frontend and Playwright (`make install`, `make test-frontend`, `make dev`) |
| GNU Make | 4.x | Every entrypoint in this repo |
| Docker with Compose v2 | — | `make up`, `make test-e2e`, `make ci` |

`make install` fails without all four.

## Run 

Run the built application in Docker:

```sh
make up
```

Open <http://localhost:8080>. Nginx serves the frontend and proxies `/api/*` to the backend.

## Develop 

Run the backend and the frontend development servers:

```sh
make install
make test-backend
make test-frontend
make test-e2e
```

## Containers

One `docker-compose.yml` with two profiles:

- `dev` — built images, nginx on 8080 proxying `/api`, SQLite on a named volume. `make up`.
- `test` — built images, nginx on 8080 proxying `/api`, ephemeral SQLite. `make test-e2e`.

## Per-story QA

Every story closes with an agentic QA report in `qa/story-1.<M>.md` covering performance,
coverage, accessibility, security, and functional-in-real-Chrome, each with a verdict and
evidence. A story is not done without it, alongside a green `make ci`.

## Configuration

Every backend setting lives in `backend/app/config.py` and has a working local default. Copy
`.env.example` to `.env` **at the repository root** — that is the path `Settings` reads — to
override. `.env` is git-ignored; `.env.example` carries placeholders only.
