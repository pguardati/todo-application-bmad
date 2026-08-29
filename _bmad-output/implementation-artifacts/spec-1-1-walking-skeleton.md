---
title: 'Story 1.1 — Walking Skeleton: Runnable, Testable, Deployable Shell'
type: 'feature'
created: '2026-08-29'
status: 'in-review'
baseline_revision: 'c26724b28db53e03fb78eb892f6e695de3a57fa4'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-todo-application-typescript-2026-08-28/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-bmad-todo-application-typescript-2026-08-24/mockups/main.html'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The repository holds only planning artifacts and a README — there is no runnable code, no persistence, no test harness, and no CI, so no vertical slice of the Todo board has anywhere to land.

**Approach:** Author the architecture's Structural Seed source tree exactly: a FastAPI + SQLModel backend with a `Todo` table, one session-per-request dependency, a central error envelope and a `/api/health` contract; a Vite + React shell serving the black-canvas design tokens through a same-origin `/api` proxy; both wrapped by one root `Makefile`, one `docker-compose.yml` with `dev`/`test` profiles, a Playwright harness, and a GitHub Actions workflow that calls `make ci` only. No user-facing todo behaviour.

## Boundaries & Constraints

**Always:**
- Source tree matches the Structural Seed exactly (`backend/app/{main,config,db,models,schemas,errors,repository,services,deps}.py`, `backend/app/routers/{todos,health}.py`, `backend/tests/`, `frontend/src/{api,hooks,components,styles}`, `e2e/`, root `Makefile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`).
- Layered imports only: `routers → services → repository → models`; `components → hooks → api/client`. No sibling imports inside a layer.
- The only error shape is `{error, message}`, produced solely by exception handlers registered in `main.py` from an `AppError` hierarchy in `errors.py`; FastAPI `RequestValidationError` remaps 422 → 400 `VALIDATION_ERROR`; unhandled → 500 `INTERNAL_ERROR` with detail logged, never returned.
- `GET /api/health` returns `200 {"status":"ok","database":"ok"}` after a real DB round-trip, `503` with the same two keys when the round-trip fails. No other health/readiness endpoint anywhere.
- Schema created only by `SQLModel.metadata.create_all()` at startup, idempotently. No migration tool, no `CREATE`/`ALTER` string, no `text()`, no string-built SQL.
- All SQL lives in `repository.py`; the single per-request `Session` dependency in `db.py` commits once on success and rolls back on exception; repository flushes/refreshes but never commits; no router or service touches the engine or constructs a `Session`.
- `Todo` model fields: `id` (UUIDv4 string PK), `description`, `completed`, `created_at` (UTC), `user_id` (nullable, absent from every response schema).
- Wire format camelCase via one shared alias-generator base in `schemas.py`; snake_case in Python; no per-field aliases. Timestamps UTC ISO 8601 with offset.
- Frontend issues relative `/api/*` requests only. No absolute API URL and no API-host env var in frontend source or build config. No CORS middleware.
- Every backend setting is read once into a typed `Settings` in `config.py` with a working local default; no other `os.environ` read; `.env` git-ignored, `.env.example` placeholders only.
- Every `DESIGN.md` token declared once in `frontend/src/styles/tokens.css` and referenced only as `var(--token)`. No hard-coded hex outside that file, no CSS-in-JS, no UI framework dependency.
- Fixed ports: backend 8000, Vite 5173, nginx 8080.
- Both container images run as a non-root user; each has a `HEALTHCHECK`.
- `.github/workflows/ci.yml` triggers on `pull_request` and invokes `make` targets only — no inline `pytest`, `npm test`, or `docker compose`.
- Coverage gates enforced by the tools themselves: `--cov-fail-under=70` and Vitest `coverage.thresholds.lines: 70`. No shell-script gate.

**Block If:**
- A pinned stack version does not exist on its registry and no same-minor release is available to substitute.
- Docker is unavailable or the `test` profile cannot build, blocking the compose and E2E acceptance criteria.

**Never:**
- No todo list/create/toggle/delete endpoints or UI behaviour (stories 1.2–1.4 own those). `routers/todos.py` exists with an empty router mounted; `services.py` and `repository.py` carry only what health and the fixtures need.
- No migration framework, no starter template, no `docker-compose.<env>.yml` variant, no second health endpoint, no committed secret.
- No Playwright journey spec with assertions — the harness runs an empty-but-passing suite.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health, DB reachable | `GET /api/health`, temp SQLite file present | `200 {"status":"ok","database":"ok"}` after a trivial query | No error expected |
| Health, DB unreachable | `GET /api/health`, session/query raises | `503 {"status":"error","database":"error"}` — same two keys | Caught in the health router; no stack trace in the body |
| Unknown resource | Request raising `NotFoundError` | `404 {"error":"NOT_FOUND","message":"..."}` | Handler in `main.py` |
| Malformed request body | Body failing Pydantic validation | `400 {"error":"VALIDATION_ERROR","message":"..."}` — never 422 | `RequestValidationError` handler remaps |
| Unhandled exception | Any uncaught error in a request | `500 {"error":"INTERNAL_ERROR","message":"Internal server error"}` | Exception logged with traceback; body carries no detail |
| Settings with no env vars | Empty environment | `Settings()` resolves every field to a working local default | No error expected |
| Session on request failure | Request handler raises | Session rolls back and closes; nothing committed | Exception propagates to handlers |

</intent-contract>

## Code Map

The repository currently contains no application code. Everything below is created by this story.

- `README.md` -- only existing tracked file besides planning artifacts; extend with the single documented start command (NFR-3).
- `.gitignore` -- exists with `node_modules/`, `dist/`, `.DS_Store`, `*.log`; must gain `.env`, `__pycache__/`, `.venv/`, `*.db`, `.pytest_cache/`, `coverage`/`htmlcov`, `.ruff_cache/`, `playwright-report/`, `test-results/`.
- `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` -- read-only. §"Structural Seed" is the authoritative source tree; §"Stack" holds the exact version pins; §"Consistency Conventions" fixes naming, ports, and styling.
- `_bmad-output/planning-artifacts/ux-designs/.../DESIGN.md` -- read-only. Frontmatter is the exact token set for `tokens.css`.
- `_bmad-output/planning-artifacts/ux-designs/.../mockups/main.html` -- read-only. Its `:root` block is the literal custom-property naming to mirror (`--color-*`, `--font-*`, `--space-1..8`, `--control-size`, `--add-btn-size`); its `.app` shell is the layout the React shell reproduces.
- `_bmad-output/planning-artifacts/epics.md` -- read-only. "Story 1.1" section holds the acceptance criteria and test table this spec implements.
- Local toolchain evidence: system `python3` is 3.10 and `node` is 22, so the backend must pin Python 3.13 through `uv` (`requires-python`/`.python-version`) rather than relying on the system interpreter; `uv 0.11.13`, `make 4.3`, `docker 29.4.3` with Compose v5 are present.

## Tasks & Acceptance

**Execution:**

- `.gitignore` -- add `.env`, Python, coverage, and Playwright artifact entries -- AD-16 requires `.env` ignored and keeps build noise untracked.
- `backend/pyproject.toml` -- create with `requires-python = ">=3.13"`, pinned FastAPI 0.141.1 / SQLModel 0.0.39 / Pydantic 2.13.4 / Uvicorn 0.52.4, dev group pytest 9.1.1 / httpx 0.28.1 / pytest-cov / Ruff 0.16.5, plus Ruff and `--cov-fail-under=70` config -- one pinned dependency set and a tool-enforced coverage gate (AD-13).
- `backend/app/config.py` -- create typed `Settings` (pydantic-settings) with `database_url`, `app_name`, `debug`, each with a local default, and a cached accessor -- AD-14; the only place environment is read.
- `backend/app/errors.py` -- create `AppError` base plus `NotFoundError` and `ValidationError` subclasses carrying `code`, `message`, `status_code` -- AD-4 source of the envelope.
- `backend/app/models.py` -- create the `Todo` SQLModel table: `id` UUIDv4 str PK, `description` str, `completed` bool default False, `created_at` UTC datetime, `user_id` nullable str -- AD-15 seam without auth.
- `backend/app/schemas.py` -- create the camelCase alias-generator base and `TodoRead`/`TodoCreate` mirroring the model minus `user_id`, plus `HealthRead` -- AD-2, AD-3; sole contract authority.
- `backend/app/db.py` -- create the engine from `Settings`, `init_db()` calling `SQLModel.metadata.create_all()`, and the `get_session` dependency that commits on success and rolls back on exception -- AD-8, AD-9.
- `backend/app/repository.py` -- create the only SQL surface; for this story a `check_connection(session)` executing a trivial `select(1)` -- AD-9.
- `backend/app/services.py` -- create `check_health(session)` returning the health payload, translating a failed round-trip into the degraded result -- AD-1 layer between router and repository.
- `backend/app/deps.py` -- create the `current_scope` dependency returning the implicit v1 owner -- AD-15.
- `backend/app/routers/health.py` -- create `GET /api/health` returning 200 or 503 with exactly `status` and `database` -- AD-12; the only health endpoint.
- `backend/app/routers/todos.py` -- create an empty `APIRouter` prefixed `/api/todos` with no routes yet -- the seam stories 1.2–1.4 extend.
- `backend/app/main.py` -- create the app factory: mount both routers, register `AppError`, `RequestValidationError` (422→400) and generic `Exception` handlers, call `init_db()` on startup, configure stdlib logging to stdout -- AD-4, AD-8.
- `backend/tests/conftest.py` -- create the per-test temp-file SQLite fixture and an `httpx.ASGITransport` client fixture every later story reuses -- AD-11.
- `backend/tests/test_health.py` -- create healthy and degraded integration tests plus the `Settings`-defaults unit test -- covers the story's whole test table for the backend.
- `backend/Dockerfile` -- create a multi-stage `uv`-based image running as a non-root user with `HEALTHCHECK` hitting `/api/health` -- AD-12, AD-16.
- `frontend/package.json` -- create with pinned React 19.2.8 / TypeScript 7.0.2 / Vite 8.2.2 / @vitejs/plugin-react 6.1.1 / Vitest 4.1.11 / @testing-library/react 16.3.3 and scripts for dev, build, test, coverage, lint -- pinned stack (AD stack table).
- `frontend/vite.config.ts` -- create with the React plugin, dev server on 5173, `/api` proxy to `http://backend:8000` or `http://localhost:8000`, and Vitest config with `coverage.thresholds.lines: 70` -- AD-5, AD-13.
- `frontend/tsconfig.json` -- create strict TypeScript config for the React app -- convention.
- `frontend/src/styles/tokens.css` -- create declaring every `DESIGN.md` token once as a custom property, matching the mockup's `:root` names -- UX-DR1.
- `frontend/src/App.tsx` -- create the shell: black canvas, the add-bar and TODO/DONE column skeleton from the mockup, styling via `var(--token)` only, no data fetching -- UX-DR1, UX-DR2 (behaviour arrives in 1.2+).
- `frontend/src/main.tsx`, `frontend/index.html` -- create the React entrypoint with `lang="en"`, a document title, and one landmark -- accessibility floor.
- `frontend/src/App.test.tsx` -- create a smoke render test so the frontend suite and its coverage gate are real -- AD-13.
- `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/hooks/useTodos.ts` -- create as the seams stories 1.2+ fill; keep minimal and layer-legal -- Structural Seed.
- `frontend/nginx.conf`, `frontend/Dockerfile` -- create the static build served by nginx on 8080 proxying `/api` to the backend, non-root, with `HEALTHCHECK` -- AD-5, AD-14, AD-16.
- `e2e/playwright.config.ts`, `e2e/package.json` -- create the Playwright harness targeting `http://localhost:8080`, pinned Playwright 1.62.1 and @axe-core/playwright 4.13.0 -- AD-11; the empty suite must pass.
- `docker-compose.yml` -- create the single file with `dev` and `test` profiles, named volume for dev and tmpfs for test, and `depends_on: {backend: {condition: service_healthy}}` on the frontend -- AD-12, AD-14.
- `.env.example` -- create with placeholder values only, mirroring `Settings` fields -- AD-14, AD-16.
- `Makefile` -- create `install`, `dev`, `test`, `test-backend`, `test-frontend`, `test-e2e`, `lint`, `coverage`, `db-reset`, `ci` -- AD-13; the only entrypoint.
- `.github/workflows/ci.yml` -- create a `pull_request`-triggered job invoking `make` targets only -- AD-13.
- `README.md` -- document the single start command and the `make` target list -- NFR-3.
- `qa/story-1.1.md` -- write the agentic QA report with a pass/fail verdict and evidence for each of the five checks (performance, coverage, accessibility, security, functional-in-Chrome) -- epic Definition of Done.

**Acceptance Criteria:**

- Given a clean checkout, when `make install` then `make dev` runs, then the backend serves on 8000 and Vite on 5173 with `/api/*` proxied to the backend, and the black canvas renders at `localhost:5173`.
- Given the created tree, when it is compared to the Structural Seed, then every listed path exists and no extra top-level application directory does.
- Given the frontend source and build config, when searched for `http://`, an API-host env var, a hard-coded hex value, or a UI-framework dependency, then none is found outside `tokens.css` (which holds the design hexes) and the dev-proxy target in `vite.config.ts`.
- Given the running backend, when the codebase is searched for health routes, then `GET /api/health` is the only one.
- Given the application starts twice against the same database file, when startup completes, then `create_all()` has produced the schema idempotently with no migration tool and no raw DDL present in the repository.
- Given the backend source, when searched for `os.environ`, `text(`, or string-built SQL, then the only environment reads are inside `config.py` and no raw-SQL construct exists.
- Given the `test` compose profile, when brought up, then images build, nginx serves on 8080 and proxies `/api`, the frontend waits on the backend's `service_healthy` gate, and both containers run as non-root.
- Given the `Makefile`, when each of the ten targets runs, then it succeeds, and `make ci` fails if either coverage gate is forced below 70% and passes at the story's real numbers.
- Given `.github/workflows/ci.yml`, when read, then it triggers on `pull_request` and contains no inline `pytest`, `npm test`, or `docker compose` invocation.
- Given `make test-e2e`, when the empty Playwright suite runs against the `test` profile, then it exits zero.
- Given the story is complete, when the work is published, then a branch cut from `main` carries the change, a pull request targets `main` naming the story, its FRs and ADs and any `make db-reset` requirement, and `qa/story-1.1.md` records the five agentic checks.

## Spec Change Log

## Review Triage Log

## Design Notes

Health degradation is observable, not hypothetical: `services.check_health` calls `repository.check_connection` inside a `try`, and the router chooses the status code from the result. That keeps the 503 path unit-reachable by patching the repository, with no `Session` construction outside `db.py`.

```python
# routers/health.py
@router.get("/health")
def health(session: Session = Depends(get_session), response: Response = ...):
    payload = check_health(session)
    response.status_code = 200 if payload["database"] == "ok" else 503
    return payload
```

`tokens.css` mirrors the mockup's `:root` block verbatim so the composition reference and the app cannot drift.

## Verification

**Commands:**
- `make install` -- expected: backend and frontend and e2e dependencies resolve with the pinned versions.
- `make lint` -- expected: Ruff and the frontend linter exit zero.
- `make test-backend` -- expected: health healthy/degraded and `Settings`-defaults tests pass; coverage ≥70% enforced by `--cov-fail-under=70`.
- `make test-frontend` -- expected: the smoke test passes; Vitest line coverage gate ≥70% enforced by config.
- `make test-e2e` -- expected: the `test` profile comes up healthy and the empty Playwright suite exits zero.
- `make ci` -- expected: the full chain is green.
- `make db-reset` -- expected: the database file is removed and recreated on next start.
- `curl -s -o /dev/null -w '%{http_code}' localhost:8000/api/health` -- expected: `200`.
- `grep -rn 'os.environ' backend/app` -- expected: matches only in `config.py`.
- `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.tsx' --include='*.ts'` -- expected: no matches.
- `docker compose --profile test up --build -d` -- expected: both services healthy; `curl localhost:8080/api/health` returns 200.

**Manual checks (if no CLI):**
- `docker compose --profile test config` shows both images with a non-root `user` and the frontend's `depends_on` health condition.
