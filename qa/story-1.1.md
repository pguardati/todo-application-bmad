# Agentic QA — Story 1.1: Walking Skeleton

**Story:** 1.1 — Walking Skeleton: Runnable, Testable, Deployable Shell
**Date:** 2026-08-29
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
| `GET /api/health` p50 (localhost, 50 samples) | 1.3 ms |
| `GET /api/health` p95 | 2.4 ms |
| `GET /api/health` max | 4.8 ms |
| Cold `make dev` to first successful `/api/health` through the Vite proxy | < 15 s |
| `test` profile `up --wait` to both containers healthy | ~11 s |
| Shell `DOMContentLoaded` (nginx build, Chrome) | 33 ms |
| Shell `load` (nginx build, Chrome) | 34 ms |

p95 of 2.4 ms is two orders of magnitude inside the epic's ≤500 ms localhost budget.

## 2. Coverage — the gates actually fire (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (138 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` in `backend/pyproject.toml` |
| Frontend | 85.71% lines (18/21) | 70% | Vitest `coverage.thresholds.lines: 70` in `frontend/vite.config.ts` |

Negative proof that each gate fails when forced above the real number:

- `uv run coverage report --fail-under=100` → exit **2**.
- `npx vitest run --coverage --coverage.thresholds.lines=99` → exit **1**.

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

Run with axe-core 4.10.2 in Chrome against the `test` profile at `http://localhost:8080`,
rule set `wcag2a, wcag2aa, wcag21a, wcag21aa`:

```json
{ "violations": [], "passes": 17, "incomplete": [] }
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
| Backend container non-root | `docker compose --profile test exec backend id` → `uid=10001(appuser)` |
| Frontend container non-root | `docker compose --profile test exec frontend id` → `uid=101(nginx)` |
| No `text()` or string-built SQL | grep for `text(`, `CREATE TABLE`, `ALTER TABLE`, `execute("` over `backend/app` → no matches |
| No migration framework | grep for `alembic`, `migrate` over `backend/` → no matches |
| No `dangerouslySetInnerHTML` / `innerHTML` | grep over `frontend/src` → no matches |
| Config read in one place | grep for `os.environ`, `getenv` over `backend/app` → no matches; every setting flows through `Settings` in `config.py` |
| No CORS middleware | grep for `cors` over `backend/app` → no matches |
| Errors reveal nothing | the unhandled-exception test asserts the body is exactly `{"error":"INTERNAL_ERROR","message":"Internal server error"}`; the traceback goes to the logger only |
| No absolute API URL in the client | grep for `http://` over `frontend/src` and `frontend/index.html` → no matches; the single occurrence is the sanctioned dev-proxy target in `vite.config.ts` |
| No hard-coded hex outside `tokens.css` | grep for `#[0-9a-f]{3,8}` over `frontend/src` excluding `tokens.css` → no matches |

## 5. Functional in real Chrome (Chrome DevTools MCP)

**Verdict: PASS**

**`test` profile, nginx at `http://localhost:8080`:**

- Console messages: **none** — zero errors, zero warnings.
- Network requests: 4, all `200` — `/`, the hashed JS bundle, the hashed CSS bundle, `/favicon.ico`.
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
| Clean bring-up: `make install` then `make dev` | Backend on 8000, Vite on 5173, `/api/*` proxied, black canvas renders |
| `docker compose --profile test up --build --wait` | Both containers reach `healthy`; the frontend is gated on the backend's `service_healthy` |
| `make db-reset` | `backend/todo.db` removed; recreated by `create_all()` on next start |
| Idempotent schema | `init_db()` called twice in one process succeeds; `sqlite_master` holds exactly one `CREATE TABLE todo`, produced by SQLModel metadata |
| `make ci` | Exit 0 |
| `make test-e2e` | Empty Playwright suite exits 0 against the `test` profile |
| Only health endpoint | The live OpenAPI document lists exactly one path: `/api/health` |
