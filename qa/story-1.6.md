# Agentic QA — Story 1.6: Error Handling and Retry

**Story:** 1.6 — Error Handling and Retry
**Date:** 2026-08-29
**Verdict:** PASS (5 / 5 checks)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS |
| Security | PASS |
| Functional (real Chrome) | PASS |

Measurements were taken against the `test` compose profile (nginx `:8080` → backend `:8000` →
tmpfs SQLite), driven through a real Chromium page (Playwright 1.62.1) unless stated otherwise.
Failures were induced at the browser with `page.route` (500 envelope, `connectionrefused` abort),
so nothing in this report depends on breaking the running services, and no row was left behind.

---

## 1. Performance — error latency and no duplicate in-flight retries (NFR-1, NFR-2)

**Verdict: PASS**

Cold open with `GET /api/todos` answered `500`:

| Metric | Value |
| --- | --- |
| `domContentLoaded` | 50 ms |
| `loadEventEnd` | 50 ms |
| First contentful paint | 92 ms |
| `goto` → alert carrying the server message on screen | 148 ms |
| Retry activation → board rendered (response held open ~300 ms) | 412 ms |

`GET /api/todos` latency through the edge, 30 sequential in-page fetches with no interception:

| p50 | p95 | max | n |
| --- | --- | --- | --- |
| 3.4 ms | 4.4 ms | 9.7 ms | 30 |

p95 of 4.4 ms is ~113× inside the ≤500 ms localhost budget, unchanged from 1.5.

**No duplicate in-flight retries.** The retry response was held open, `Retry` was clicked, and then
clicked again while the first fetch was still in flight:

```
inFlightRetryCalls:          1     (list requests observed between the two clicks)
retryDisabledWhileInFlight:  true
totalListCalls:              2     (one mount fetch + one retry)
```

The control is `disabled={loading}` for the duration of the in-flight load, so a second activation
cannot issue a second fetch — one activation, exactly one request. The jsdom suite pins the same
invariant from the other side (`recovers on retry by mouse and by Enter, issuing exactly one fetch
per activation` asserts `listTodos` was called 1 → 2 → 3 across mount, click and Enter), and every
mutation-failure case asserts `listTodos` was still called exactly once, proving a failed create,
toggle or delete triggers no hidden re-fetch.

No auto-retry, no backoff, no polling: the only fetch beyond mount is the one the user asks for.

## 2. Coverage — both gates, every `AppError` subclass and every client error path (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (212 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 94.30% lines (116/123), 88% branch | 70% | Vitest `coverage.thresholds.lines: 70` |

Test counts: backend **42 passed** (was 39), frontend **29 passed** (was 25), E2E **5 journeys**
passed (was 4). Exactly the epic's Story 1.6 test table, one new E2E journey.

**Every `AppError` subclass.** `backend/tests/test_errors.py` walks `AppError.__subclasses__()`
recursively and compares the result to the expected mapping table, so the check is exhaustive rather
than enumerated:

| Class | status | code |
| --- | --- | --- |
| `AppError` | 500 | `INTERNAL_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |

Mutation-proven, twice, each on a cleared bytecode cache:

- Adding `class ConflictError(AppError)` with `409`/`CONFLICT` and no mapping →
  `test_every_app_error_maps_to_its_status_and_code` fails on the subclass-set assertion
  (`1 failed, 1 passed`). A future subclass without a mapping cannot land silently.
- Changing `NotFoundError.status_code` to `400` → the same test fails
  (`assert (400, 'NOT_FOUND') == (404, 'NOT_FOUND')`).

**Every client error path.** `useTodos.messageOf` has exactly two branches and both are covered:

| Path | Covered by |
| --- | --- |
| `ApiRequestError` → server `message` verbatim | `surfaces the server message and stops loading when the fetch fails` (hook), `surfaces a failed load as an alert with a retry control…` (component) |
| anything else → `NETWORK_ERROR_MESSAGE` | `falls back to the single authored string when there is no response at all` (hook, bare `TypeError`), `falls back to the single authored string when the failure carries no response` (component) |
| failed create → optimistic row removed, typed text kept | `rolls back only the failed row, keeps the typed text and surfaces the message` |
| failed toggle → only that row reverts | `returns only the toggled row to its column and surfaces the message` |
| failed delete → row re-inserted at its index | `re-inserts the deleted row at its original index and surfaces the message` |
| retry: loading true in flight, error cleared on success, re-surfaced on a second failure | `retry re-issues the fetch, clears the error on success and re-surfaces a second failure` (hook) |
| self-clearing on the next confirmed mutation | the three mutation cases each retry the action successfully and assert the alert disappears |

Mutation-proven:

- Dropping `setError(null)` from the hook's loader → `2 failed | 27 passed` (both retry-recovery
  cases). A retry that fetches but never clears the alert is caught.
- Deleting the `<button>Retry</button>` from the alert → `5 failed | 24 passed` (the failed-load
  case, the retry-recovery case, and all three mutation-failure cases, which now assert the alert
  offers a retry).

Per-file, `App.tsx`, `components/AddBar.tsx`, `components/TodoColumn.tsx` and
`components/TodoRow.tsx` report 100% lines. The two files with uncovered lines are `useTodos.ts` at
96.20% (lines 123, 146, 155 — the three "nothing to do" early returns, unchanged from 1.4) and
`api/client.ts` at 81.81% (the four stubbed one-liners, covered end to end by the Playwright
journeys).

## 3. Accessibility — announcement, focus, Enter-operability, no colour-only signal (UX-DR6, UX-DR10, NFR-4)

**Verdict: PASS**

**axe-core 4.13.0** (`@axe-core/playwright` 4.13.0, Chromium against `http://localhost:8080`, rule
set `wcag2a, wcag2aa, wcag21a, wcag21aa`) **on the error state**:

```json
{ "violations": [], "incomplete": [], "passes": 20 }
```

Zero violations and zero incomplete results with the alert and its retry button on screen. The scan
of the recovered board reports the single `color-contrast` finding carried through 1.2–1.5, scoped
to a completed row's `.label` (`--color-text-done` on `--color-canvas`) — pre-existing, untouched by
this story, and absent from the error state itself.

**Announced as one unit.** The error region is a `div[role="alert"]` — an ARIA live region — and the
`Retry` button lives *inside* it, so message and remedy are announced together:

```json
{ "role": "alert", "tag": "DIV", "text": "Internal server errorRetry", "lineCount": 1 }
```

One short line, no validation paragraph (UX-DR7).

**Keyboard-reachable and Enter-operable.** From the add-bar input, a single `Tab` lands on the retry
control, and it carries the accent focus-visible ring:

```json
{ "tag": "BUTTON", "text": "Retry", "insideAlert": true, "focusVisibleOutline": "rgb(76, 175, 106)" }
```

Pressing `Enter` on it recovered the board in a real browser (`alerts: 0`, `retryButtons: 0`,
`status: 0`, the seeded row rendered). It is a real `<button type="button">`, so Enter and Space work
with no custom key handling. The complete interactive set under `main` in the error state is
`["BUTTON:Add todo", "INPUT:New todo", "BUTTON:Retry"]` — three controls, each with an accessible
name, in source order.

**Not signalled by colour alone.** Computed styles of the error region and its button:

| Property | Value |
| --- | --- |
| region `color` | `rgb(232, 232, 232)` (`--color-text`) |
| region `border-bottom-color` | `rgb(34, 34, 34)` (`--color-border`) |
| region `background-color` | `rgba(0, 0, 0, 0)` (transparent) |
| button `color` / `border-color` | `rgb(76, 175, 106)` (`--color-accent`) |
| button box | 69 × 29 px |

No red, no new hue, no coloured background. The signal is the announced role, the sentence itself,
the rule beneath it and the presence of a control — a monochrome rendering loses nothing. `git diff`
of `frontend/src/styles` shows only `var(--token)` references (`--color-accent`,
`--color-accent-hover`, `--color-text-muted`, `--color-border`, `--radius-sm`, `--space-1/3/4`,
`--font-size-body`) and no hex literal.

**The list area is never blank.** In the error state, both `h2` headings (`["TODO", "DONE"]`) and
both `ul` lists are still mounted, and `role="status"` is absent — the board is framed, not wiped.

## 4. Security — a forced 500 leaks nothing while the log keeps the detail (AD-4, AD-16, NFR-6)

**Verdict: PASS**

A probe route raising `RuntimeError` with deliberately sensitive detail — SQL, an owner value, a
file path and a dependency version — was driven through the **production backend image**
(`docker compose exec backend`), calling the real `create_app()` ASGI app so the registered handlers
are the ones under test:

```
raise RuntimeError("SELECT id, description, owner FROM todo WHERE owner = 's3cr3t-owner-8675309'
                    -- /srv/app/repository.py:42 sqlmodel 0.0.31")
```

Response:

```
STATUS  500
HEADERS [('content-length', '60'), ('content-type', 'application/json')]
BODY    {"error":"INTERNAL_ERROR","message":"Internal server error"}
```

60 bytes, exactly the two keys `error` and `message`. Scanned for
`Traceback`, `RuntimeError`, `SELECT`, `todo`, `owner`, `s3cr3t`, `8675309`, `repository.py`,
`/srv/app`, `sqlmodel`, `probe`, `File "`:

```
BODY_LEAKS []
```

No stack trace, no SQL, no file path, no dependency version, no echo of the request body, not even
the route name. Meanwhile the captured log holds everything an operator needs:

```
LOG_FIRST             ERROR app.main Unhandled error while processing POST /api/probe/leak
LOG_HAS_RUNTIMEERROR  True
LOG_HAS_SQL           True
LOG_HAS_SECRET        True
LOG_HAS_TRACEBACK     True
```

Mutation-proven, each on a cleared bytecode cache:

- Returning `str(exc)` as the 500 `message` → `2 failed | 40 passed`
  (`test_forced_500_leaks_nothing_while_the_log_keeps_the_detail` and the 1.1 rollback case).
- Downgrading `logger.exception` to `logger.error` (message kept, exception dropped) →
  `1 failed | 41 passed` — the log half of the assertion is load-bearing on its own.

**The envelope holds on every real route.** Through nginx, against the live stack:

| Request | Status | Body |
| --- | --- | --- |
| `POST /api/todos {"description":"  "}` | 400 | `{"error":"VALIDATION_ERROR","message":"Invalid request."}` |
| `POST /api/todos {"description":123}` (framework 422) | **400** | `{"error":"VALIDATION_ERROR","message":"Invalid request."}` |
| `PATCH /api/todos/00000000-0000-4000-8000-000000000000` | 404 | `{"error":"NOT_FOUND","message":"Todo not found."}` |
| `DELETE` on the same unknown id | 404 | `{"error":"NOT_FOUND","message":"Todo not found."}` |

Never a `422`, never a FastAPI `detail` array, no id echo beyond the caller's own input. And no
route builds one of these itself:

```
$ grep -rn "JSONResponse\|HTTPException" backend/app/routers
(no match)
```

Every non-2xx body in the application comes from the three handlers registered in `app/main.py`.

**One authored client string.**

```
$ grep -rn "'[A-Z][a-z].*\.'" frontend/src --include=*.ts --include=*.tsx | grep -v test
frontend/src/api/client.ts:3:export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Please try again.'
```

The single hit. The client invents no per-code copy; every other message the user sees is the
server's `message` verbatim, and `NETWORK_ERROR_MESSAGE` is used only when there is no AD-4 envelope
to read (no response, or an edge error answering HTML).

`/openapi.json` is still not reachable through the edge (nginx serves the SPA `index.html`,
`Content-Type: text/html`). No new endpoint, parameter or response field was added by this story.

## 5. Functional — real Chrome with `/api/*` blocked, then unblocked (FR-1, FR-4, NFR-2)

**Verdict: PASS**

A real Chromium page was driven with every `/api/*` request aborted as `connectionrefused`, then
unblocked:

| Step | Result |
| --- | --- |
| Cold open, `/api/*` blocked | `alert` reads `Could not reach the server. Please try again.` + `Retry` — the single authored string, never a raw `TypeError` |
| Board while blocked | Both `TODO`/`DONE` headings and both lists mounted, zero rows, no `role="status"` remnant |
| Submit `Water the plants` while blocked | Alert stays, **typed text preserved** (`"Water the plants"`), optimistic row reverted (`todoRows: 0`) — no silent data loss |
| `Tab` from the input | Focus lands on `Retry`, inside the alert, with the accent focus ring |
| `Enter` on `Retry`, `/api/*` unblocked | Alert and retry button gone, `role="status"` gone, the real seeded row `Fix the auth bug×` rendered from the live backend — **no page reload** |
| Cold open with a forced `500` envelope, then a successful retry | Alert shows `Internal server error` verbatim; retry renders both columns; `alertGone: true`, `statusGone: true` |

```json
{ "pageErrors": [] }
```

Zero uncaught page errors across the whole sequence. The only console entries are the browser's own
network log lines for the failures we deliberately induced
(`net::ERR_CONNECTION_REFUSED`, `500 (Internal Server Error)`); no application error, no React
warning, no unhandled rejection. The probe deleted the row it created and left the table empty
(`rowsLeftBehind: 0`).

`make ci` was run end to end: Ruff check and format clean, frontend `tsc --noEmit` clean, backend
42 tests at 99% coverage, frontend 29 tests at 94.30% lines, and all **five** Playwright journeys
green with the compose profile torn down with `--volumes`.

**Observation, not a gate.** When the alert unmounts after a successful retry, focus falls back to
`body` rather than moving to a surviving control. No AC or UX decision covers focus placement after
a retry (UX-DR's focus rule is about a row leaving the DOM, which `TodoRow.moveFocusOut` still
handles), so nothing was added for it; it is recorded here for a future slice.

---

## Change surface

```
$ git diff --stat story-1.5-intentional-empty-state
 backend/tests/test_errors.py        | new
 backend/tests/test_health.py        | +43
 e2e/tests/error-handling.spec.ts    | new
 frontend/src/App.test.tsx           | +91 / -...
 frontend/src/App.tsx                | +10 / -...
 frontend/src/hooks/useTodos.test.ts | +60
 frontend/src/hooks/useTodos.ts      | +51 / -...
 frontend/src/styles/app.css         | +31
 qa/story-1.6.md                     | new
```

Three production files changed:

- `frontend/src/hooks/useTodos.ts` — the mount fetch is extracted into a `load` callback guarded by
  a `mounted` ref (replacing the effect-local `active` flag, which a retry could not reuse), and
  exposed as `retry`. The mutation paths are byte-identical; the only behavioural addition is
  `setError(null)` on a successful load.
- `frontend/src/App.tsx` — the error `<p>` becomes a `<div role="alert">` holding the message and a
  `<button type="button">Retry</button>`, disabled while a load is in flight. The loading branch and
  both columns are untouched.
- `frontend/src/styles/app.css` — `.state-line-error` becomes a flex row and gains a nested
  `button` rule (plus `:hover`, `:focus-visible`, `:disabled`). No new class name, no new token, no
  hex literal, no red.

Backend production code is unchanged: the AD-4 contract landed in 1.1 and this story pins it.

## Decisions a reviewer should spot-check

- **AD-1** — layering untouched; `App` gained no state and no API call, retry lives in the hook.
- **AD-4** — one envelope, three codes, handler-produced only; 422 remapped to 400; the client
  authors exactly one string.
- **AD-6** — a failed mutation still reverts only the affected todo; whole-list restore was not
  introduced, and each mutation-failure case now also asserts no extra list fetch.
- **AD-11** — the `AppError` hierarchy mapping is asserted exhaustively over `__subclasses__()`.
- **AD-16** — the forced 500 returns the generic envelope while `logger.exception` keeps the detail.
- **UX-DR6/DR10** — one short announced line plus a retry control; no red, no new hue, no toast.
