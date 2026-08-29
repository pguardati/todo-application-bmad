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
Failures were induced at the browser with `page.route` (500 envelope, `connectionrefused` abort)
except in the ad-hoc check, which stops the real backend container. Nothing in this report left a
row behind.

---

## 1. Performance — error latency and no duplicate in-flight retries (NFR-1, NFR-2)

**Verdict: PASS**

**The AC's quantity — failed response → alert on screen.** A `window.fetch` wrapper stamped
`performance.now()` when the response settled and a `MutationObserver` stamped it again the moment
`[role="alert"]` entered the DOM. Two runs:

| Run | response settled | alert in DOM | **delta** |
| --- | --- | --- | --- |
| 1 | 123.3 ms | 135.2 ms | **11.9 ms** |
| 2 | 123.0 ms | 128.5 ms | **5.5 ms** |

5.5–11.9 ms against the ≤100 ms budget. (The earlier `goto` → alert figure of ~148 ms is a
*different* quantity — it includes document load, bundle parse and React's first paint — and is not
what the AC bounds; it is recorded below as context, not as the budgeted number.)

Page-level context, cold open with `GET /api/todos` answered `500`:

| Metric | Value |
| --- | --- |
| `domContentLoaded` | 50 ms |
| `loadEventEnd` | 50 ms |
| First contentful paint | 92 ms |
| `goto` → alert on screen (load + parse + render + the delta above) | 148 ms |
| Retry activation → board rendered (response deliberately held ~250 ms) | 333 ms |

`GET /api/todos` latency through the edge, 30 sequential in-page fetches with no interception:

| p50 | p95 | max | n |
| --- | --- | --- | --- |
| 3.4 ms | 4.4 ms | 9.7 ms | 30 |

p95 of 4.4 ms is ~113× inside the ≤500 ms localhost budget, unchanged from 1.5.

**No duplicate in-flight retries.** The retry response was held open, `Retry` was activated by
Enter, and then force-clicked again while the first fetch was still in flight:

```
duringRetry: { listCalls: 1, disabled: true, statusRegions: 0, headings: 2, todoList: 1, doneList: 1 }
afterRetry:  { listCalls: 1, alerts: 0, status: 0 }
```

One activation, exactly one request. The invariant is enforced **in the hook**, not by the button:
`load()` holds the running promise in an `inFlight` ref and a re-entrant `retry()` returns that same
promise instead of issuing a second `listTodos()`. `disabled={loading}` is the visible half of the
same rule. Both halves are pinned independently and both are mutation-proven (§2).

No auto-retry, no backoff, no polling: the only fetch beyond mount is the one the user asks for.

## 2. Coverage — both gates, every `AppError` subclass and every client error path (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (212 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 94.53% lines (121/128), 92.59% branch | 70% | Vitest `coverage.thresholds.lines: 70` |

Test counts: backend **43 passed** (was 39), frontend **33 passed** (was 25), E2E **5 journeys**
passed (was 4). One new E2E journey, as the story allows.

**Every `AppError` subclass.** `backend/tests/test_errors.py` walks `AppError.__subclasses__()`
recursively and compares the result to the expected mapping table, so the check is exhaustive rather
than enumerated:

| Class | status | code |
| --- | --- | --- |
| `AppError` | 500 | `INTERNAL_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ValidationError` | 400 | `VALIDATION_ERROR` |

**Scope of that claim.** `__subclasses__()` only sees classes whose defining module has been
imported, so the test imports `app.main` to pull in the whole shipped module graph. "Exhaustive"
therefore means *exhaustive over everything the application imports* — a subclass defined in a module
the app never imports is out of reach by construction, not covered by this test. The companion
assertion derives its status and code sets from the classes themselves rather than from the literal
table, so it fails if `app/errors.py` changes underneath it.

Mutation-proven, each on a cleared bytecode cache:

- Adding `class ConflictError(AppError)` with `409`/`CONFLICT` and no mapping →
  `test_every_app_error_maps_to_its_status_and_code` fails on the subclass-set assertion
  (`1 failed, 1 passed`).
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
| re-entrant `retry()` coalesces into the fetch already running | `coalesces re-entrant retries into the one fetch already in flight` (hook) |
| the retry button cannot issue a second fetch while one is in flight | `issues no second fetch while a retry is still in flight` (component) |
| a retry with rows on screen keeps the columns mounted | `re-inserts the deleted row at its original index and surfaces the message` (extended) |
| the hook writes no state after unmounting mid-flight | `never touches state once the hook has unmounted mid-flight` (hook) |
| self-clearing on the next confirmed mutation | the three mutation cases each retry the action successfully and assert the alert disappears |

Mutation-proven (frontend, full suite each time):

| Mutation | Result |
| --- | --- |
| Drop `setError(null)` from the hook's loader | `2 failed \| 31 passed` (both retry-recovery cases) |
| Delete the `<button>Retry</button>` from the alert | `5 failed` (failed-load, retry-recovery and all three mutation-failure cases) |
| Drop the `inFlight` guard from `load()` | `1 failed` — `coalesces re-entrant retries into the one fetch already in flight` |
| Drop `disabled={loading}` from the button | `1 failed` — `issues no second fetch while a retry is still in flight` |
| Revert the render condition to `loading ? …` (columns unmount during a retry) | `1 failed` — the extended failed-delete case |
| Delete all three `if (mounted.current)` guards | `1 failed` — `never touches state once the hook has unmounted mid-flight` |

The unmount case needs a note: React 19 silently discards a state update on an unmounted root, so a
behavioural assertion cannot see the difference. The hook test therefore wraps `useState` through a
`vi.mock('react', …)` shim that records every setter call, asserts zero writes after `unmount()`, and
is paired with `still writes state while the hook is mounted` so the recorder itself cannot rot into a
tautology.

Per-file, `App.tsx`, `components/AddBar.tsx`, `components/TodoColumn.tsx` and
`components/TodoRow.tsx` report 100% lines. The two files with uncovered lines are `useTodos.ts` at
96.42% (lines 135, 158, 167 — the three "nothing to do" early returns, unchanged from 1.4) and
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

**Announced as one unit, in two runs.** The error region is a `div[role="alert"]` — an ARIA live
region — and the `Retry` button lives *inside* it, so message and remedy are announced together. The
message is wrapped in its own `<span>` so the two do not run together as one string:

```json
{ "childRuns": ["SPAN:Internal server error", "BUTTON:Retry"] }
```

One short line, no validation paragraph (UX-DR7).

**Keyboard-reachable and Enter-operable.** From the add-bar input, a single `Tab` lands on the retry
control, and it carries the accent focus-visible ring:

```json
{ "tag": "BUTTON", "text": "Retry", "insideAlert": true, "focusVisibleOutline": "rgb(76, 175, 106)" }
```

Pressing `Enter` on it recovered the board in a real browser (`alerts: 0`, `retryButtons: 0`,
`status: 0`, the row rendered). It is a real `<button type="button">`, so Enter and Space work with no
custom key handling. The complete interactive set under `main` in the error state is
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
the rule beneath it and the presence of a control — a monochrome rendering loses nothing.
`git diff story-1.5-intentional-empty-state -- frontend/src/styles` adds no hex literal; every value
is a `var(--token)` already in `tokens.css` (`--color-accent`, `--color-accent-hover`,
`--color-text-muted`, `--color-border`, `--radius-sm`, `--space-1/3/4`, `--font-size-body`).

**Narrow viewport.** The region is `flex-wrap: wrap` with `min-width: 0` and `overflow-wrap: anywhere`
on the message, so a long server message wraps and drops the button to its own line instead of pushing
it off-screen. At 320 px with a 130-character message:

```json
{ "alertBox": { "w": 272, "h": 178 }, "buttonBox": { "w": 69, "h": 29 },
  "buttonInsideAlert": true, "documentOverflows": false }
```

**The list area is never blank — including mid-retry.** In the error state both `h2` headings
(`["TODO", "DONE"]`) and both `ul` lists are mounted with zero rows, and `role="status"` is absent.
While a retry is in flight with rows already on screen, the columns stay mounted and no second live
region appears (`statusRegions: 0`, `headings: 2`, `todoList: 1`, `doneList: 1`) — the loading line
renders only when there is no error, so a retry never blanks the board and never puts an `alert` and a
`status` on screen at once.

## 4. Security — a forced 500 leaks nothing while the log keeps the detail (AD-4, AD-16, NFR-6)

**Verdict: PASS**

**In the production image, through the shipped handlers.** A probe route raising `RuntimeError` with
deliberately sensitive detail — SQL, an owner value, a file path and a dependency version — was
driven through the **production backend image** (`docker compose exec backend`), calling the real
`create_app()` ASGI app:

```
raise RuntimeError("SELECT id, description, owner FROM todo WHERE owner = 's3cr3t-owner-8675309'
                    -- /srv/app/repository.py:42 sqlmodel 0.0.31")
```

Response:

```
STATUS  500
HEADERS [('content-length', '60'), ('content-type', 'application/json')]
BODY    {"error":"INTERNAL_ERROR","message":"Internal server error"}
BODY_LEAKS []
```

60 bytes, exactly the two keys `error` and `message`, and none of
`Traceback`, `RuntimeError`, `SELECT`, `todo`, `owner`, `s3cr3t`, `8675309`, `repository.py`,
`/srv/app`, `sqlmodel`, `probe`, `File "`. Meanwhile the captured log holds everything an operator
needs:

```
LOG_FIRST             ERROR app.main Unhandled error while processing POST /api/probe/leak
LOG_HAS_RUNTIMEERROR  True
LOG_HAS_SQL           True
LOG_HAS_SECRET        True
LOG_HAS_TRACEBACK     True
```

**In the suite, on a real route.** Two pytest cases cover this, and both assert through the same
`assert_generic_500_body` helper, which checks the key set and the code and then **scans the body for
the leak tokens** — there is deliberately no whole-body equality assertion in either case, so the scan
is the assertion that fires, not decoration behind a stricter check:

| Case | Failure forced at |
| --- | --- |
| `test_forced_500_leaks_nothing_while_the_log_keeps_the_detail` | a probe route on a fixture-local `create_app()` |
| `test_a_failing_service_on_a_real_route_answers_the_generic_envelope` | the service call behind the shipped `GET /api/todos`, monkeypatched to raise, driven against `app.main:app` with `raise_app_exceptions=False` |

Both also assert the logged record carries `exc_info`, the request path, and the exception detail —
looked up by logger name (`app.main`) with a readable failure when nothing was logged.

Mutation-proven, each on a cleared bytecode cache:

| Mutation | Result |
| --- | --- |
| Return `str(exc)` as the 500 `message` | `3 failed \| 40 passed` (both new cases + the 1.1 rollback case) |
| Downgrade `logger.exception` to `logger.error` (message kept, exception dropped) | `2 failed \| 41 passed` — both new cases, on the log half alone |
| Append the request path to the generic message (`…at /srv/app{path}`) | `3 failed \| 40 passed` — the leak scan fires on `/srv/app` with the key set and code still valid, which is what makes the scan load-bearing |

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

**One authored client string.**

```
$ grep -rn "'[A-Z][a-z].*\.'" frontend/src --include=*.ts --include=*.tsx | grep -v test
frontend/src/api/client.ts:3:export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Please try again.'
```

The single hit. Every other message the user sees is the server's `message` verbatim, and
`NETWORK_ERROR_MESSAGE` is used only when there is no AD-4 envelope to read — no response at all, or
an edge error answering HTML (confirmed live in §5: nginx answers `504 text/html` with the backend
down and the user still sees the one authored sentence, never a parser error).

`/openapi.json` is still not reachable through the edge (nginx serves the SPA `index.html`,
`Content-Type: text/html`). No new endpoint, parameter or response field was added by this story.

## 5. Functional — real Chrome, `/api/*` blocked then unblocked (FR-1, FR-4, NFR-2)

**Verdict: PASS**

A real Chromium page was driven with every `/api/*` request aborted as `connectionrefused`, then
unblocked:

| Step | Result |
| --- | --- |
| Cold open, `/api/*` blocked | `alert` reads `Could not reach the server. Please try again.` + `Retry` — the single authored string, never a raw `TypeError` |
| Board while blocked | Both `TODO`/`DONE` headings and both lists mounted, zero rows, no `role="status"` remnant |
| Submit `Water the plants` while blocked | Alert stays, **typed text preserved**, optimistic row reverted (`todoRows: 0`) — no silent data loss |
| `Tab` from the input | Focus lands on `Retry`, inside the alert, with the accent focus ring |
| `Enter` on `Retry`, `/api/*` unblocked | Alert and retry button gone, `role="status"` gone, the real row `Fix the auth bug×` rendered from the live backend — **no page reload** |
| Cold open with a forced `500` envelope, then a successful retry | Alert shows `Internal server error` verbatim; retry renders both columns; `alertGone: true`, `statusGone: true` |

```json
{ "pageErrors": [] }
```

Zero uncaught page errors across the whole sequence. The only console entries are the browser's own
network log lines for the failures we deliberately induced (`net::ERR_CONNECTION_REFUSED`,
`500 (Internal Server Error)`); no application error, no React warning, no unhandled rejection.

### Ad-hoc (manual, per the epic's test taxonomy) — the backend actually stopped

The spec's manual check was executed for real against the `test` profile, stopping and restarting the
backend **container** rather than intercepting at the browser:

| Step | Observed |
| --- | --- |
| One todo on the board, then `docker compose stop backend` | container Stopped |
| `GET /api/todos` through the edge with the backend down | `504`, `content-type: text/html` — nginx's own error page, *not* the AD-4 envelope |
| Submit `Water the plants` | `alert` = `Could not reach the server. Please try again.` + `Retry`. The client parsed the HTML 504, found no envelope and fell back to its one authored string — comprehensible to a non-developer, no status code, no HTML fragment |
| Board while down | typed text preserved (`"Water the plants"`), the optimistic row reverted, the pre-existing row still on screen (`todoRows: 1`, `doneRows: 0`), both headings present, `statusRegions: 0` |
| `docker compose start backend`, wait for `/api/health` 200 | container Started |
| Click `Retry` | alert gone in **79 ms**, the server's rows rendered, `role="status"` absent, the typed text still in the input, **no page reload** |
| After the run | `pageErrors: []`, `rowsLeftBehind: 0` |

One caveat worth recording: the `test` profile's SQLite lives on tmpfs, so restarting the container
starts from an empty table (`tableAfterRestart: 0`). To prove the retry renders *live server data*
rather than a cached list, a row was created through the API after the restart; the retry then
rendered exactly that row (`["Fix the auth bug×"]`).

`make ci` was run end to end after every patch: Ruff check and format clean, frontend `tsc --noEmit`
clean, backend 43 tests at 99% coverage, frontend 33 tests at 94.53% lines, and all **five**
Playwright journeys green with the compose profile torn down with `--volumes`.

---

## Change surface

Real output of `git diff --stat story-1.5-intentional-empty-state -- backend frontend e2e`
(the report itself is excluded, since its own size changes as this section is written):

```
 backend/tests/test_errors.py        |  38 +++++++++
 backend/tests/test_health.py        |  95 ++++++++++++++++++++++
 e2e/tests/error-handling.spec.ts    |  66 +++++++++++++++
 frontend/src/App.test.tsx           | 155 ++++++++++++++++++++++++++++++++----
 frontend/src/App.tsx                |  14 ++--
 frontend/src/hooks/useTodos.test.ts | 155 +++++++++++++++++++++++++++++++++++-
 frontend/src/hooks/useTodos.ts      |  39 ++++++---
 frontend/src/styles/app.css         |  37 +++++++++
 8 files changed, 568 insertions(+), 31 deletions(-)
```

Three production files changed:

- `frontend/src/hooks/useTodos.ts` — the mount fetch is extracted into a `load` callback guarded by a
  `mounted` ref (replacing the effect-local `active` flag, which a retry could not reuse) and by an
  `inFlight` ref (so a re-entrant `retry()` returns the promise already running), and exposed as
  `retry`. The mutation paths are byte-identical; the only behavioural addition is `setError(null)` on
  a successful load.
- `frontend/src/App.tsx` — the error `<p>` becomes a `<div role="alert">` holding `<span>{error}</span>`
  and a `<button type="button">Retry</button>`, disabled while a load is in flight; the loading line
  renders only when there is no error, so a retry keeps both columns mounted.
- `frontend/src/styles/app.css` — `.state-line-error` becomes a wrapping flex row and gains nested
  `span` and `button` rules (plus `:hover`, `:focus-visible`, `:disabled`). No new class name, no new
  token, no hex literal, no red.

Backend production code is unchanged: the AD-4 contract landed in 1.1 and this story pins it.

## Deferred (recorded in the spec's frontmatter, not fixed here)

- An optimistic create still in flight when a retry lands can render alongside its persisted twin
  until the create settles (`useTodos.ts`). Low severity, narrow window.
- Keyboard focus drops to `<body>` when the retry button disables mid-flight and again when the alert
  unmounts on success. No AC or UX decision states where focus should land afterwards.

## Decisions a reviewer should spot-check

- **AD-1** — layering untouched; retry lives in the hook, `App` gained no state and no API call.
- **AD-4** — one envelope, three codes, handler-produced only; 422 remapped to 400; the client
  authors exactly one string.
- **AD-6** — a failed mutation still reverts only the affected todo; whole-list restore was not
  introduced, and each mutation-failure case also asserts no extra list fetch.
- **AD-11** — the `AppError` hierarchy mapping is asserted over the subclass tree, with the import
  caveat above stated rather than glossed.
- **AD-16** — the forced 500 returns the generic envelope while `logger.exception` keeps the detail,
  proven both on a probe route and on the shipped `GET /api/todos`.
- **UX-DR6/DR10** — one short announced line plus a retry control; no red, no new hue, no toast.
