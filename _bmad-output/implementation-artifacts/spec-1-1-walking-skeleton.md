---
title: 'Story 1.1 — Walking Skeleton: Runnable, Testable, Deployable Shell'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_revision: 'c26724b28db53e03fb78eb892f6e695de3a57fa4'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-todo-application-typescript-2026-08-28/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-bmad-todo-application-typescript-2026-08-24/mockups/main.html'
warnings: ['oversized']
deferred:
  - summary: >-
      The compose dev profile hardcodes user "1000:1000" and runs npm install over the
      bind-mounted host frontend/, so it breaks for any host UID other than 1000.
    evidence: |-
      docker-compose.yml pins the dev frontend to uid 1000 and installs into the bind mount,
      clobbering the host node_modules with container-built binaries. make dev (the path the
      story's acceptance criteria actually exercise) runs on the host, so this never surfaced.
    location: >-
      docker-compose.yml
    severity: medium
  - summary: >-
      Two design tokens fall below WCAG AA contrast on the black canvas.
    evidence: |-
      --color-text-done #555555 is roughly 3:1 and --color-control #444444 roughly 2:1 against
      #000000, below the 4.5:1 AA floor for text. The story's axe run is clean only because the
      empty shell renders no completed row and no delete control; story 1.4 will render both.
      NFR-5 makes WCAG AA a stretch goal rather than a gate, and the values come from DESIGN.md,
      so this is a design decision to revisit, not a defect in this story.
    location: >-
      frontend/src/styles/tokens.css
    severity: medium
  - summary: >-
      The frontend has no linter or formatter, only a typecheck, while the backend enforces
      ruff check and ruff format --check.
    evidence: |-
      frontend package.json defines "lint": "tsc --noEmit". A >100-character line already sits
      in client.test.ts with nothing flagging it. make lint satisfies AD-13 as specified, so
      adding ESLint/Prettier is a parity improvement rather than a story-1.1 defect.
    location: >-
      frontend/package.json
    severity: low
  - summary: >-
      nginx sets no security response headers and there is no dependency-update automation or
      vulnerability scanning across the three pinned ecosystems.
    evidence: |-
      nginx.conf sets no X-Content-Type-Options, X-Frame-Options, or CSP, and no proxy timeouts.
      No Dependabot/Renovate config and no scan step exist despite exact pins in Python, npm,
      and Docker. AD-16's baseline enumerates specific controls and does not include these, so
      they are hardening beyond the story's stated security floor.
    location: >-
      frontend/nginx.conf, .github/workflows/ci.yml
    severity: low
  - summary: >-
      The app shell has no <form>, so the "submit via Enter" affordance cannot work as structured.
    evidence: |-
      App.tsx renders a bare input beside a type="button" control. Enter cannot submit without a
      form or an explicit key handler. Story 1.3 owns the add-bar behaviour and will restructure
      this, so it is noted rather than fixed here.
    location: >-
      frontend/src/App.tsx
    severity: low

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

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 19: (high 1, medium 10, low 8)
- defer: 5: (high 0, medium 2, low 3)
- reject: 8: (high 0, medium 2, low 6)
- addressed_findings:
  - `[high]` `[patch]` `created_at` lost tzinfo on the SQLite round-trip, serializing `createdAt` without a UTC offset in violation of AD-3 — reproduced directly, then fixed at the contract authority with a shared `UtcDatetime` annotation in `schemas.py` so every future schema inherits it; pinned by a test.
  - `[medium]` `[patch]` The camelCase wire contract was asserted nowhere (`HealthRead`'s single-word fields are casing-invariant) — added a `TodoRead` alias-serialization test; removing the alias generator now fails 2 tests.
  - `[medium]` `[patch]` The commit half of the session lifecycle was untested — added the mirror of the rollback probe; removing `session.commit()` now fails a test.
  - `[medium]` `[patch]` `init_db()` never ran under the suite (`ASGITransport` skips lifespan) — added a direct idempotency test using SQLAlchemy `inspect()`.
  - `[medium]` `[patch]` No `.dockerignore` on either image, so the build context could carry a local `.env`, `.venv/`, `node_modules/`, and `todo.db` — added both.
  - `[medium]` `[patch]` The frontend HEALTHCHECK probed `/` only, so the compose gate passed with a broken `/api` proxy — now probes `/api/health` through nginx; verified it flips unhealthy when the backend stops.
  - `[medium]` `[patch]` `.env` was resolved from the process CWD (`backend/`) while the README pointed at the repo root, so a README-following user's `.env` was silently ignored — env file now resolved from the repo root.
  - `[medium]` `[patch]` `make dev` used `kill %1`, which has no job control in Make's `sh`, leaving uvicorn holding port 8000 after Ctrl-C — now traps a captured PID.
  - `[medium]` `[patch]` `client.ts` parsed every non-OK response as JSON, so nginx's own HTML 502/504 threw a raw `SyntaxError` past `ApiRequestError` — guarded, with a test.
  - `[medium]` `[patch]` `make install` used `npm install` against lockfiles the Docker build installs with `npm ci` — switched to `npm ci`.
  - `[medium]` `[patch]` `sprint-status.yaml` still read `backlog` for epic-1 and story 1.1 with the PR open — synced to `in-progress` / `review`.
  - `[low]` `[patch]` `check_health` returned the degraded payload leaving the session in a failed transaction for `get_session` to commit — added `session.rollback()`.
  - `[low]` `[patch]` The `RequestValidationError` handler discarded `exc`, making 400s invisible in operations — detail now logged server-side only, response body unchanged.
  - `[low]` `[patch]` `make dev` bound uvicorn to `0.0.0.0`, exposing a no-auth local app to the LAN — bound to `127.0.0.1`.
  - `[low]` `[patch]` CI lacked `permissions`, `timeout-minutes`, and a `concurrency` group — all three added, make-targets-only rule intact.
  - `[low]` `[patch]` `trace: 'on-first-retry'` with `retries: 0` could never capture a trace — changed to `retain-on-failure`.
  - `[low]` `[patch]` The QA report cited axe-core 4.10.2 against a 4.13.0 pin — re-ran with the bundled 4.13.0 build and corrected the report.
  - `[low]` `[patch]` `connect_args={"check_same_thread": False}` was applied unconditionally, breaking any non-SQLite URL at import — gated on a sqlite URL.
  - `[low]` `[patch]` The README listed no prerequisites and never mentioned the per-story QA report — both added.

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

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change**

Story 1.1's walking skeleton, authored from the architecture's Structural Seed: a FastAPI + SQLModel backend with the `Todo` table, one session-per-request dependency, a central `{error, message}` envelope and the `GET /api/health` contract; a Vite + React shell rendering the black canvas from `DESIGN.md` tokens through a same-origin `/api` proxy; and the surrounding envelope — both non-root Dockerfiles, one `docker-compose.yml` with `dev`/`test` profiles, the Playwright harness, the ten-target `Makefile`, and a `pull_request` CI workflow that invokes `make` only. No user-facing todo behaviour; `routers/todos.py` and the `api`/`hooks` seams exist empty for stories 1.2–1.4.

**Files changed** (48 files, plus lockfiles; branch `story-1.1-walking-skeleton`, commits `2a91f70` and `f6b8cc7`)

- `backend/app/{config,db,models,schemas,errors,repository,services,deps,main}.py` -- the layered backend: typed `Settings` as the only env read, engine and session lifecycle, the `Todo` table with its nullable `user_id` seam, the camelCase contract authority, the `AppError` hierarchy and its three central handlers.
- `backend/app/routers/{health,todos}.py` -- the sole health endpoint; an empty todos router as the seam later stories extend.
- `backend/tests/{conftest,test_health}.py` -- the temp-file SQLite and ASGI client fixtures every later story reuses, plus 13 tests covering the whole I/O matrix.
- `backend/{pyproject.toml,Dockerfile,.dockerignore}` -- pinned dependencies with a tool-enforced coverage gate; a non-root image with a health-gated `HEALTHCHECK`.
- `frontend/src/styles/{tokens.css,app.css}`, `frontend/src/{App.tsx,main.tsx,App.test.tsx}` -- every design token declared once, referenced only via `var()`; the shell and its smoke test.
- `frontend/src/api/{types.ts,client.ts}`, `frontend/src/hooks/useTodos.ts` (+ tests) -- the relative-path client and state seams.
- `frontend/{package.json,vite.config.ts,tsconfig.json,index.html,nginx.conf,Dockerfile,.dockerignore}` -- pinned stack, dev proxy, Vitest coverage threshold, and the nginx image.
- `e2e/{package.json,playwright.config.ts,tests/.gitkeep}` -- the harness, proven by an empty-but-passing suite as the story's test table specifies.
- `Makefile`, `docker-compose.yml`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`, `README.md` -- the single entrypoint, the two profiles, and CI.
- `qa/story-1.1.md` -- the agentic QA report: five checks, each with a verdict and evidence.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- epic-1 to `in-progress`, story 1.1 to `review`.

**Review findings breakdown**

19 patches applied (1 high, 10 medium, 8 low), 5 items deferred, 8 rejected as noise or as belonging to a later story. No intent gap and no spec defect: every finding was fixable in place without human input, so no repair loopback was needed.

**Follow-up review recommendation**

`true`. Patched severities: high 1, medium 10, low 8. One high-severity patched finding triggers the recommendation on its own; the weighted score is `3 x 10 + 1 x 8 = 38`, well past the threshold of 5.

**Verification performed**

- `make ci` -- exit 0, twice: once on the initial implementation and once after the patches. 13 backend tests at 99% line coverage, 9 frontend tests at 88.46%, lint clean, the compose `test` profile healthy, and the empty Playwright suite exiting zero.
- Both coverage gates proven load-bearing by forcing the threshold above the real number: backend `--fail-under=100` exits 2, frontend `thresholds.lines=95` exits 1.
- The AD-3 timestamp defect was reproduced directly before the fix (a `Todo` written and read back in a fresh session returned `tzinfo=None`, serializing `createdAt` with no offset) and confirmed fixed after it (the wire value now ends in `Z`).
- The three new coverage tests were each proven load-bearing by mutating the source: removing the alias generator fails 2 tests, removing the `UtcDatetime` annotation fails 2, removing `session.commit()` fails 1.
- Static invariant checks: `os.environ` appears only in `config.py`; no hex literal in any `.ts`/`.tsx` source; `GET /api/health` is the only health route; no `text()` or string-built SQL.
- I/O matrix audit: all seven rows are covered by tests that ran and passed -- health healthy and degraded, the `NOT_FOUND` envelope, the 422-to-400 remap, the generic 500 with its rollback assertion, `Settings` defaults, and session rollback on request failure.

**Residual risks**

- The operational acceptance criteria -- the compose profiles, the nginx `/api` proxy, non-root containers, the Structural Seed's shape -- are discharged by one-shot agentic observation recorded in `qa/story-1.1.md`, not by anything `make ci` re-runs. The story's own test table specifies an empty E2E suite, so the first automated traversal of the proxy arrives with story 1.2's journey spec.
- Two pinned versions could not be honoured literally: the backend coverage gate is enforced by `[tool.coverage.report] fail_under` rather than pytest's `--cov-fail-under` (which prints its failure but exits 0 under the pinned pytest 9), and the `uv` builder image tag does not resolve on this Docker daemon, so the Dockerfile copies a pinned `uv` binary instead. AD-13's substance -- tool-enforced, no shell gate -- holds in both cases.
- A few unpinned transitive dev dependencies were resolved to nearest available releases (`pydantic-settings`, `pytest-cov`, `jsdom`, `@testing-library/jest-dom`); every version the architecture spine pins is used exactly.
- `NODE_ENV=production` is set in this environment, so every npm invocation passes `--include=dev` and the Vitest scripts set `NODE_ENV=test`. A machine without that env var is unaffected, but the flags are load-bearing here.
