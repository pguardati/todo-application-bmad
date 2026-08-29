# Agentic QA — Story 1.1: Walking Skeleton

**Story:** 1.1 — Walking Skeleton: Runnable, Testable, Deployable Shell
**Date:** 2026-08-29 (re-run after code review; 19 patch findings applied)
**Verdict:** PASS (5 / 5 checks)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS |
| Security | PASS |
| Functional (real Chrome) | PASS |

---

## 1. Performance — startup and health baseline (NFR-1)

**Verdict: PASS**

| Metric | Measurement |
| --- | --- |
| `GET /api/health` p50 — direct, 50 samples | 1.3 ms |
| `GET /api/health` p95 — direct | 2.4 ms |
| `GET /api/health` p50 — through nginx, 50 samples | 2.4 ms |
| `GET /api/health` p95 — through nginx | 6.0 ms |
| `GET /api/health` max — through nginx | 7.7 ms |
| Cold `make dev` to first successful `/api/health` through the Vite proxy | < 15 s |
| `test` profile `up --wait` to both containers healthy | ~11 s |
| Shell `DOMContentLoaded` (nginx build, Chrome) | 33 ms |
| Shell `load` (nginx build, Chrome) | 34 ms |

p95 of 6.0 ms through the full edge path is two orders of magnitude inside the epic's
≤500 ms localhost budget.

## 2. Coverage — the gates actually fire (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (147 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` in `backend/pyproject.toml` |
| Frontend | 88.46% lines (23/26) | 70% | Vitest `coverage.thresholds.lines: 70` in `frontend/vite.config.ts` |

Negative proof that each gate fails when forced above the real number:

- `uv run coverage report --fail-under=100` → exit **2**.
- `npx vitest run --coverage --coverage.thresholds.lines=95` → exit **1**.

**Mutation proof that the assertions are load-bearing** — each of these mutations was applied
to the source, the suite run, and the source restored:

| Mutation | Result |
| --- | --- |
| Remove `alias_generator=to_camel` from the `ApiSchema` base | 2 failed, 11 passed |
| Remove `created_at: UtcDatetime` (revert to a bare `datetime`) | 2 failed, 11 passed |
| Remove `session.commit()` from `db.get_session` | 1 failed, 12 passed |

**Deviation from the spec's literal wording, deliberate.** The spec named
`--cov-fail-under=70` in pytest addopts. Under the pinned pytest 9.1.1, pytest-cov
prints `FAIL Required test coverage ... not reached` but **still exits 0** — it raises
the failure after pytest has computed the exit status. Reproduced with pytest-cov
7.0.0 and 7.1.0; both exit 0. A gate that cannot fail the build is not a gate, so
backend enforcement moved to `coverage report` with `fail_under = 70` under
`[tool.coverage.report]`, invoked from `make test-backend` and `make coverage`. This
still satisfies AD-13's binding requirement — the tool enforces the gate, no shell
check does — and the reason is recorded in `backend/pyproject.toml`.

## 3. Accessibility — empty shell

**Verdict: PASS**

Run with **axe-core 4.13.0** — the exact build bundled with the pinned
`@axe-core/playwright` 4.13.0, served to the page from the running container rather than a
CDN so the version in evidence is the version the E2E harness will use — in Chrome against
the `test` profile at `http://localhost:8080`, rule set `wcag2a, wcag2aa, wcag21a, wcag21aa`:

```json
{ "axeVersion": "4.13.0", "violations": [], "passes": 17, "incomplete": [] }
```

Document basics, read from the live page:

| Requirement | Observed |
| --- | --- |
| `lang` | `en` |
| Title | `Todo` |
| Landmarks | exactly one `<main>` |
| Accessible names | `Add todo` button, `New todo` textbox, `TODO` / `DONE` regions and headings |
| Focus on load | the `New todo` textbox |

Accessibility tree snapshot:

```
RootWebArea "Todo"
  main
    button "Add todo"
    textbox "New todo" focusable focused
    region "TODO" > heading "TODO" level=2, list "TODO"
    region "DONE" > heading "DONE" level=2, list "DONE"
```

## 4. Security — baseline sweep (AD-16)

**Verdict: PASS**

| Assertion | Evidence |
| --- | --- |
| No committed secret | `.env.example` holds placeholders only; no `.env` tracked |
| `.env` git-ignored | `git check-ignore -v .env` → `.gitignore:6:.env` |
| No secret reaches an image layer | `backend/.dockerignore` and `frontend/.dockerignore` added. Probed with a planted `backend/.env` and `backend/todo.db`: the backend build context is exactly `.python-version`, `app/`, `pyproject.toml`, `uv.lock`; the frontend context is exactly `index.html`, `nginx.conf`, `package.json`, `package-lock.json`, `src/`, `tsconfig.json`, `vite.config.ts`. No `.env`, `.venv/`, `node_modules/`, `*.db` or coverage output in either. |
| Backend container non-root | `docker compose --profile test exec backend id -u` → `10001` |
| Frontend container non-root | `docker compose --profile test exec frontend id -u` → `101` |
| No `text()` or string-built SQL | grep for `text(`, `CREATE TABLE`, `ALTER TABLE`, `execute("` over `backend/` → no matches (the idempotency test uses SQLAlchemy `inspect()`, not raw SQL) |
| No migration framework | grep for `alembic`, `migrate` over `backend/` → no matches |
| No `dangerouslySetInnerHTML` / `innerHTML` | grep over `frontend/src` → no matches |
| Config read in one place | grep for `os.environ`, `getenv` over `backend/app` → no matches; every setting flows through `Settings` in `config.py` |
| No CORS middleware | grep for `cors` over `backend/app` → no matches |
| Errors reveal nothing | the unhandled-exception test asserts the body is exactly `{"error":"INTERNAL_ERROR","message":"Internal server error"}`; the traceback and the validation detail go to the logger only |
| Dev server is not LAN-exposed | `make dev` binds uvicorn to `127.0.0.1:8000` (confirmed with `ss -ltn`); only the container keeps `0.0.0.0` |
| No absolute API URL in the client | grep for `http://` over `frontend/src` and `frontend/index.html` → no matches; the single occurrence is the sanctioned dev-proxy target in `vite.config.ts` |
| No hard-coded hex outside `tokens.css` | grep for `#[0-9a-f]{3,8}` over `frontend/src` excluding `tokens.css` → no matches |
| Lockfile-faithful installs | `make install` uses `npm ci` in both `frontend/` and `e2e/`, matching the Dockerfiles; the run left both lockfiles unmodified |

## 5. Functional in real Chrome (Chrome DevTools MCP)

**Verdict: PASS**

**`test` profile, nginx at `http://localhost:8080`:**

- Console messages: **none** — zero errors, zero warnings.
- Network requests: 3, all `200` — `/`, the hashed JS bundle, the hashed CSS bundle.
- Failed resources: **none**.
- `GET /api/health` through the nginx `/api` proxy → `200 {"status":"ok","database":"ok"}`.
- Computed styles: body background `rgb(0, 0, 0)` (`--color-canvas`), body color
  `rgb(232, 232, 232)` (`--color-text`), section label `rgb(76, 175, 106)` (`--color-accent`).

**`dev` profile, Vite at `http://localhost:5173`:**

- Console messages: only Vite's two HMR `connecting…` / `connected.` debug lines. Zero errors.
- Failed resources: **none** — `performance.getEntriesByType('resource')` filtered on
  `responseStatus >= 400` returns an empty list.
- `fetch('/api/health')` through the Vite proxy → `200 {"status":"ok","database":"ok"}`.

Three defects were found by this check and fixed before the verdict:

1. The frontend image set `NODE_ENV=development` for the whole builder stage, so `vite build`
   shipped the **development** React build (Chrome logged the React DevTools notice). Fixed by
   dropping the `ENV` and relying on `npm ci --include=dev` for the install step only.
2. The add-bar input had no `id`/`name`, which Chrome reported as a form-field issue. Fixed by
   adding `id="new-todo"` and `name="description"`.
3. The dev server returned `404` for `/favicon.ico`. Fixed with `<link rel="icon" href="data:," />`,
   which carries no hex and adds no asset.

---

## Ad-hoc checks

| Check | Result |
| --- | --- |
| Clean bring-up: `make install` then `make dev` | Backend on `127.0.0.1:8000`, Vite on 5173, `/api/*` proxied, black canvas renders |
| `make dev` releases its ports on Ctrl-C | SIGINT to the process group: both 8000 and 5173 released, no straggler processes. Before the fix, `kill %1` failed silently under make's non-interactive `sh` and uvicorn survived holding 8000 — reproduced, then fixed with a captured PID and an `EXIT INT TERM` trap. |
| Repo-root `.env` is actually read | Planted `APP_NAME=From Root Env` at the repo root; `Settings().app_name` resolved to it from `backend/` as CWD. Previously `env_file=".env"` resolved against `backend/`, so a `.env` created per the README was silently ignored. |
| `docker compose --profile test up --build --wait` | Both containers reach `healthy`; the frontend is gated on the backend's `service_healthy` |
| Frontend healthcheck covers the `/api` proxy | With the backend stopped, the frontend flips to `unhealthy` after its 10 retries (~55 s), the probe output showing the nginx error page. Under the previous `/`-only probe it stayed healthy with a dead proxy — the signal the whole `test` profile gates on. |
| `make db-reset` | `backend/todo.db` removed; recreated by `create_all()` on next start |
| Idempotent schema | `test_init_db_is_idempotent` calls `init_db()` twice against a temp engine and asserts the table list is `["todo"]` both times and unchanged — the lifespan path is otherwise never exercised, because `httpx.ASGITransport` does not run lifespan events |
| Timestamps carry a UTC offset (AD-3) | `test_persisted_timestamps_survive_the_round_trip_with_an_offset` writes a row, reads it in a fresh `Session` (SQLite returns it naive), and asserts the serialized `createdAt` ends in `Z`. Before the fix the wire value was `"2026-08-29T14:36:19.338681"` with no offset. |
| Wire format is camelCase (AD-2/AD-3) | `test_todo_read_serializes_camel_case_with_a_utc_offset` asserts `TodoRead.model_dump(by_alias=True)` carries `createdAt` — nothing previously pinned this, since `HealthRead`'s single-word fields are identical with or without the generator |
| Session commits on success (AD-9) | `test_session_commits_on_success` posts to a probe route that adds a row and returns 200, then reads it back through a separate `Session(engine)` |
| Client survives a non-envelope error body | Two tests cover an nginx-style HTML `502` and a JSON body that is not the AD-4 envelope; both surface `ApiRequestError` with the single sanctioned fallback string, not a raw `SyntaxError` |
| `make ci` | Exit 0 |
| `make test-e2e` | Empty Playwright suite exits 0 against the `test` profile |
| Only health endpoint | The live OpenAPI document lists exactly one path: `/api/health` |
