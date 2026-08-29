---
title: 'Story 1.6 — Error Handling and Retry'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '25a474812f6a972fb422ffd06cff929197851fcd'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      An optimistic create still in flight during a retry can render alongside its persisted twin.
    evidence: |-
      load() rebuilds the list as [...current.filter((row) => row.pending), ...loaded]. If the create
      has committed server-side but its response has not settled, the retry's response already carries
      the persisted row while the pending row is kept by the filter, so the same todo shows twice until
      the create settles and replaces the temp row. Narrow — it needs a retry activated inside the
      window of an in-flight create — and it predates this story in shape; the retry path is what makes
      it reachable at all.
    location: >-
      frontend/src/hooks/useTodos.ts
    severity: low
  - summary: >-
      Keyboard focus drops to `<body>` when the retry button disables mid-flight, and again when the
      alert unmounts on a successful recovery.
    evidence: |-
      `disabled={loading}` removes the focused element from the tab order while the load is in flight,
      and on success the whole alert unmounts, so a keyboard user is stranded twice. The epic's a11y
      AC asks only that the message be announced and retry be Enter-operable, both of which hold, and
      no AC or UX decision states where focus should land afterwards. `aria-disabled` plus a no-op
      handler, or a deliberate focus move to the add bar, would resolve it.
    location: >-
      frontend/src/App.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The board surfaces failures as a bare `role="alert"` line with no way out: a failed
initial fetch leaves the user staring at two empty columns with no retry, and nothing in the suite
pins the `AppError` → status/code table, the log-vs-body split on a forced 500, or the client's
single local fallback string. The epic's last slice is the one that makes every failure legible and
recoverable.

**Approach:** Add a retry affordance to the error surface — `useTodos` exposes a `retry()` that
re-issues the list fetch and clears the error on success, and `App` renders the message alongside an
Enter-operable retry button — then close the epic's Story 1.6 test table around it: a backend unit
test of the `AppError` hierarchy mapping, a forced-500 leakage/log assertion, the frontend cases for
failed load, retry recovery, network fallback and the three mutation failures, one Playwright journey
that intercepts `/api/todos`, and the agentic QA report.

## Boundaries & Constraints

**Always:**
- Every non-2xx body is exactly `{"error": "<CODE>", "message": "..."}` with `error` in
  `VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR`, produced only by the handlers already registered
  in `backend/app/main.py`. Route handlers never construct an error response inline.
- The client authors exactly one user-facing string, `NETWORK_ERROR_MESSAGE`; every other message
  shown to the user is the server's `message` verbatim.
- The error surface uses existing `DESIGN.md` tokens and existing class names only — no red, no new
  accent hue, no new hex.
- The retry control is a real `<button>` inside the existing `role="alert"` region, so it is
  announced, keyboard-reachable and Enter-operable without any custom key handling.
- A mutation failure reverts only the affected todo (AD-6) and leaves the rest of the board intact;
  a failed create preserves the typed text.
- The error self-clears on the next successful action — the existing `setError(null)` on every
  confirmed mutation, plus a successful retry.

**Block If:**
- `make ci` fails for a reason outside this story's change surface.
- Satisfying an AC would require a new error code, a new endpoint, a new response envelope, or
  user-facing copy the client invents per code — all forbidden by AD-4 and not resolvable unattended.

**Never:**
- No new error codes, no per-code client copy table, no toast/snackbar system, no auto-retry,
  no retry backoff, no undo, no error boundary component library.
- No red or new colour token for the error treatment (UX-DR10); no multi-line validation paragraph
  (UX-DR7).
- Do not change the optimistic-mutation semantics landed in 1.3/1.4 — only the surfacing of failure.
- Do not add tests beyond the epic's Story 1.6 test table; exactly one new E2E journey.
- Do not resolve the deferred nginx `proxy_read_timeout` item from 1.3 (client abort deadline) —
  it is not in this story's AC or test table.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `AppError` mapping | Each class in the hierarchy | `AppError` → 500/`INTERNAL_ERROR`, `NotFoundError` → 404/`NOT_FOUND`, `ValidationError` → 400/`VALIDATION_ERROR`; every subclass covered exhaustively | No error expected |
| Real validation failure | `POST /api/todos` with `{"description": "  "}` | `400`, body exactly `{"error": "VALIDATION_ERROR", "message": ...}` | Handler-produced, never inline |
| Real not-found | `PATCH` and `DELETE` on an unknown id | `404`, body exactly `{"error": "NOT_FOUND", "message": "Todo not found."}` | Handler-produced |
| 422 remap | A body failing FastAPI request validation | `400` with `VALIDATION_ERROR` — never `422` | Handler-produced |
| Forced 500 | A service that raises `RuntimeError` | `500`, `{"error": "INTERNAL_ERROR", "message": "Internal server error"}`; no stack trace, SQL, file path or request echo in the body; the exception detail appears in the captured log | Generic body, detail logged |
| Failed initial fetch | Stubbed `listTodos` rejects with `ApiRequestError('Internal server error', 'INTERNAL_ERROR')` | An `alert` carrying that exact message plus a `Retry` button; both column headings still present; list area not blank | The error is the outcome |
| Retry recovery | Failed load, then `listTodos` resolves `rows`, retry clicked (mouse) and activated by Enter | The board renders the rows, the alert and its retry button are gone, and the loading indicator is not left behind | Second failure re-shows the alert |
| Network fallback | `listTodos` rejects with a bare `TypeError` (no `ApiRequestError`) | The alert carries `NETWORK_ERROR_MESSAGE` — the client's single authored string | No per-code invention |
| Failed create | `createTodo` rejects | Optimistic row removed, other rows untouched, typed text preserved, alert shows the server message | Revert + recoverable error |
| Failed toggle | `updateTodo` rejects | Only that row returns to its prior column; alert shows the message | Revert + recoverable error |
| Failed delete | `deleteTodo` rejects | The row is re-inserted at its original index; alert shows the message | Revert + recoverable error |
| Error clears | Any alert on screen, then a confirmed mutation | The alert disappears without a reload | Self-clearing |

</intent-contract>

## Code Map

Backend (under `backend/`):
- `app/errors.py:1-17` -- the whole hierarchy: `AppError` (500/`INTERNAL_ERROR`), `NotFoundError`
  (404/`NOT_FOUND`), `ValidationError` (400/`VALIDATION_ERROR`). Read-only; the new unit test walks
  `AppError.__subclasses__()` so a future subclass without a mapping fails the test. `__subclasses__()`
  only sees classes whose module has been imported, so the test imports `app.main` to force the whole
  shipped module graph to register -- a subclass defined in a module the app never imports is out of
  its reach by construction.
- `app/main.py:39-67` -- the three registered handlers (`AppError`, `RequestValidationError` → 400,
  bare `Exception` → generic 500 with `logger.exception`). Read-only: the AD-4 contract already
  holds; this story pins it.
- `app/services.py:29-39` -- the only `raise` sites (`NotFoundError` on unknown id). Read-only.
- `app/routers/todos.py:18-35` -- confirms no route constructs an error response inline; this is the
  read-only evidence for that AC.
- `tests/test_health.py:44-83` -- the `error_client` fixture: `create_app()` plus probe routes and
  `ASGITransport(..., raise_app_exceptions=False)`. **Reuse this fixture pattern** for the forced-500
  leakage test; without `raise_app_exceptions=False` Starlette re-raises and the test errors.
  `test_not_found_envelope`, `test_validation_error_is_remapped_to_400` and
  `test_unhandled_error_returns_generic_500_and_rolls_back` already cover three of the epic's backend
  rows — extend, do not duplicate.
- `tests/test_todos_api.py:115-131,180-188,207-216` -- the epic's "real invalid create" and "real
  unknown id on PATCH and DELETE" rows already exist here. Read-only evidence; cite them in the QA
  report rather than writing them again.
- `tests/conftest.py:11-29` -- `database_url` / `engine` / `client` fixtures, reused verbatim.

Frontend (under `frontend/`):
- `src/hooks/useTodos.ts:42-65` -- the load effect. Extract the fetch into a `load()` callback the
  effect calls and `retry()` re-invokes; `retry` must set `loading` true, clear the error only on
  success, and keep the `active` guard so an unmounted hook never sets state. Add `retry` to
  `UseTodos` (`:16-24`).
- `src/hooks/useTodos.ts:33-35` -- `messageOf` is already the single fallback rule: non-`ApiRequestError`
  → `NETWORK_ERROR_MESSAGE`. Read-only; the network-fallback test asserts through it.
- `src/hooks/useTodos.ts:90,121,157` -- the `setError(null)` on each confirmed mutation is the
  self-clearing guarantee. Read-only.
- `src/api/client.ts:3,15-45` -- `NETWORK_ERROR_MESSAGE` is the only authored copy; `request` already
  falls back to it when the body is not the AD-4 envelope. Read-only.
- `src/App.tsx:12-16` -- the error paragraph. Replace with a `div.state-line.state-line-error`
  carrying `role="alert"`, the message, and a `<button type="button">Retry</button>` wired to
  `retry`. Keep the loading branch and both columns exactly as they are so the list area is never
  blank.
- `src/styles/app.css:152-162` -- `.state-line` / `.state-line-error` (muted text, border-bottom, no
  red). Extend with a retry-button rule reusing `--color-accent`, `--space-*` and `--radius-sm` only.
- `src/App.test.tsx:10-36` -- the `vi.mock('./api/client', importOriginal)` factory, `rows`, `saved()`
  and the `beforeEach` reset block; `:80-90` is the existing failed-load case to grow into the epic's
  rows; `:211-251` and `:282-364` already cover the three mutation-failure reverts — extend those with
  the recoverable-error assertions rather than duplicating the cases.
- `src/hooks/useTodos.test.ts:40-50` -- the existing failed-fetch hook case; the retry and
  network-fallback hook-level assertions belong beside it.
- `e2e/tests/empty-state.spec.ts:1-29` -- the `py(CLEAR)` docker-exec harness. The new journey uses
  `page.route` interception only and **touches no persisted rows**, so it needs no clear/seed.
- `e2e/tests/view-board.spec.ts:46-63` -- the `getByRole('list', { name: 'TODO' })` locator style.
- `qa/story-1.5.md` -- the report shape (verdict table, then one section per check) for `qa/story-1.6.md`.
- `Makefile:23-49` and `frontend/vite.config.ts:22-29` -- the ≥70% line gates both suites run under.

## Tasks & Acceptance

**Execution:**
- `backend/tests/test_errors.py` -- new file: the epic's unit row. Assert the `AppError` →
  (status, code) table exhaustively over the hierarchy, walking subclasses so an unmapped future
  subclass fails, and assert each carries its constructor message -- AD-4, AD-11.
- `backend/tests/test_health.py` -- extend the forced-500 case (or add one beside it using the same
  `error_client` fixture) to assert the body contains no stack trace, no SQL, no file path and no echo
  of the request body, while the captured log record carries the exception -- AD-4, AD-16.
- `frontend/src/hooks/useTodos.ts` -- extract the list fetch into a reusable loader and expose
  `retry`, which re-issues it, shows loading while in flight, clears the error on success and
  re-surfaces it on a second failure. No change to the mutation paths -- FR-1.
- `frontend/src/App.tsx` -- render the error region as an alert holding the message and a `Retry`
  button wired to `retry`, with the columns still mounted -- FR-1, UX-DR6, UX-DR8.
- `frontend/src/styles/app.css` -- style the retry button from existing tokens and existing class
  names; no red, no new hex -- UX-DR1, UX-DR10.
- `frontend/src/hooks/useTodos.test.ts` -- add the hook-level retry recovery and network-fallback
  cases -- FR-1, AD-4.
- `frontend/src/App.test.tsx` -- grow the failed-load case to assert the retry control, add a retry
  recovery case (click and Enter), and extend the three existing mutation-failure cases with the
  recoverable-error and untouched-board assertions -- FR-1, FR-4, AD-6, NFR-2.
- `e2e/tests/error-handling.spec.ts` -- the single new journey: `page.route('**/api/todos', ...)` to
  fail the load, assert the message and retry are visible and the list area is not blank, then let
  retry succeed and assert the board renders with the alert gone. Persists nothing -- FR-1, NFR-2.
- `qa/story-1.6.md` -- the agentic QA report with a verdict and evidence for each of the five checks
  (error latency and no duplicate in-flight retries, coverage with both gates and every `AppError`
  subclass and client error path, accessibility with axe-core plus announcement/focus/Enter-operability
  and no colour-only signalling, security leakage under a forced 500, functional in real Chrome with
  `/api/*` blocked then unblocked).

**Acceptance Criteria:**
- Given the running backend, when any non-2xx response is produced by any route, then its body has
  exactly the keys `error` and `message`, `error` is one of the three codes, and `grep` over
  `backend/app/routers` finds no inline error-response construction.
- Given a forced 500, when the response and the log are inspected, then the body is the generic
  envelope with no stack trace, SQL, file path, dependency version or request echo, and the log
  carries the exception.
- Given a failed initial fetch, when the board renders, then the server `message` appears verbatim
  in an `alert` alongside a `Retry` button, both column headings are present, and no loading
  indicator remains.
- Given that error state, when retry is activated by mouse or by Enter, then exactly one new fetch is
  issued and, on success, the rows render with the alert and its button gone.
- Given a total network failure with no response, when the error surfaces, then the message is
  `NETWORK_ERROR_MESSAGE` and no other client-authored copy exists in `frontend/src` besides it.
- Given a failed create, toggle or delete, when the error surfaces, then only the affected todo is
  reverted, the rest of the board is unchanged, a failed create keeps the typed text, and the alert
  disappears on the next successful action.
- Given the error region, when the diff is inspected, then it uses only `var(--token)` values already
  in `tokens.css`, introduces no red and no new hex, and its copy is a single short line.
- Given `make ci`, when it runs, then lint, both suites with their ≥70% line gates, and all five
  Playwright journeys pass.
- Given the story is complete, when the work is published, then a branch cut from
  `story-1.5-intentional-empty-state` carries the change, a pull request targets that branch naming
  the story, FR-1/FR-4/FR-7 and the ADs to spot-check (AD-1, AD-4, AD-6, AD-11, AD-16), CI is green on
  that pull request, and `qa/story-1.6.md` records the five agentic checks.

## Spec Change Log

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 15: (high 0, medium 4, low 11)
- defer: 2: (high 0, medium 0, low 2)
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[medium]` `[patch]` The "exactly one fetch per activation" invariant lived only in
    `disabled={loading}` and was asserted nowhere — deleting that prop left the whole suite green.
    `load()` gained its own in-flight guard (it is public API through `retry`) plus a component case
    that holds the promise open, clicks twice and pins the call count.
  - `[medium]` `[patch]` Activating Retry with rows on screen unmounted both columns — the board
    blanked mid-retry and `alert` + `status` were live at once, contradicting the story's own "the
    list area is not blank or broken". The loading line now renders only when there is no error, and
    a mutation-failure case activates Retry with rows present.
  - `[medium]` `[patch]` The forced-500 row was exercised only against a fixture-local probe app,
    while the epic's row names a forced *service* failure. Added a case that forces the real service
    to raise and drives `GET /api/todos` on the shipped app.
  - `[medium]` `[patch]` The QA performance check reported `goto` → alert (148 ms) as a PASS against
    a budget stated as "within 100 ms of the failed response" — a different quantity, and larger than
    the budget. Re-measured against the quantity the AC names.
  - `[low]` `[patch]` The `active`-closure → `mounted`-ref rewrite was unverified: deleting all three
    guards left the suite green. Added an unmount-while-pending case.
  - `[low]` `[patch]` `test_subclasses_do_not_share_a_status_or_a_code` read only its own literal and
    passed even with `app/errors.py` deleted; the sets are now derived from the classes.
  - `[low]` `[patch]` `__subclasses__()` only sees imported modules, so the exhaustiveness claim was
    import-order dependent. The test now imports `app.main`, and the overstated claim was corrected.
  - `[low]` `[patch]` The caplog record was selected by level alone, raising `StopIteration` instead
    of failing readably; it now filters by logger name after a non-empty assertion.
  - `[low]` `[patch]` The exact-equality body assert made the key-set check and nine-substring leak
    loop unable to fail independently, yet the QA report presented the loop as the leakage evidence.
  - `[low]` `[patch]` The alert's text content was the run-on string `Internal server errorRetry`;
    the message is now its own element.
  - `[low]` `[patch]` The E2E error state never asserted zero rows — `toHaveCount(1)` on the list
    element is uniqueness, not a row count.
  - `[low]` `[patch]` The new `.state-line-error` flex row had no `flex-wrap` / `min-width: 0` for a
    long message at a narrow viewport.
  - `[low]` `[patch]` The QA report's change-surface block was hand-written text under a
    `$ git diff --stat` prompt.
  - `[low]` `[patch]` These Design Notes sketched `load` as `.then/.catch/.finally` while the shipped
    code is `async/await` with a `mounted` ref.
  - `[low]` `[patch]` The PR body carried no Ad-hoc manual-check section, which the epic's test
    taxonomy defines as "Manual, documented in the PR".

Deferred: an optimistic row still in flight during a retry can render alongside its persisted twin;
and keyboard focus drops to `<body>` both when the retry button disables mid-flight and when the
alert unmounts on success.

Rejected as noise or out of scope on the intent's authority: the Retry control appearing on
mutation-failure alerts (it re-syncs the board and clears the error, satisfying the epic's
"dismissible or self-clearing" AC, and no AC forbids it), the E2E journey fabricating its responses
with `page.route` (the epic's own E2E row prescribes intercepting `/api/todos`), the claim that the
leak assertions cannot fail (mutation-proven by returning `str(exc)`), the bare `button` type
selector and the `--radius-sm: 0px` no-op, the empty `## Spec Change Log` heading and the `oversized`
warning flag, a generation counter or `AbortController` beyond the in-flight guard, widening the
`page.route` glob to mutation URLs (the journey performs none), a constructor-arity guard for a
hypothetical subclass (a `TypeError` is already a failure signal), case-folding the leak scan,
`setError(null)` on the mount load, and an unmounted-`retry()` guard subsumed by the in-flight guard.

## Design Notes

**Most of the backend contract already exists.** Story 1.1 registered all three handlers and 1.3/1.4
exercised 400 and 404 through real routes. This slice adds only what the epic's table demands and the
suite lacks: the exhaustive mapping unit test and the leakage/log assertion on a forced 500. Rewriting
the existing rows would be duplication, not coverage.

**Retry lives in the hook, not the component.** `App` stays a pure composition: `useTodos` owns the
loader, so retry reuses the same `active`-guarded promise chain as the mount effect and cannot leave a
stale `loading` behind. Shape:

```ts
const mounted = useRef(true)
const inFlight = useRef<Promise<void> | null>(null)

const load = useCallback((): Promise<void> => {
  if (inFlight.current !== null) {
    return inFlight.current
  }
  setLoading(true)
  const run = listTodos()
    .then((loaded) => { if (mounted.current) { setTodos(...); setError(null) } })
    .catch((caught: unknown) => { if (mounted.current) setError(messageOf(caught)) })
    .finally(() => {
      inFlight.current = null
      if (mounted.current) setLoading(false)
    })
  inFlight.current = run
  return run
}, [])
```

Unmount safety moves from the effect's local `active` flag to a `mounted` ref, because `retry` is
called from outside the effect and cannot close over it. The `inFlight` ref is what makes "exactly one
fetch per activation" a property of the hook rather than of the button's `disabled` attribute: a
re-entrant `retry()` returns the promise already running. `retry` is `load` exposed.

**Why a button inside the alert, not a separate control.** `role="alert"` is an ARIA live region, so
the message is announced on appearance; putting the button inside it keeps message and remedy in one
announced unit, and a real `<button>` is Enter-operable and tab-reachable with no key handling. Colour
is not the signal — the border and the copy are — which satisfies the "not by colour alone" check.

**The E2E journey persists nothing.** It intercepts `/api/todos` at the browser with `page.route`, so
unlike the other four journeys it needs no `py(CLEAR)` harness and cannot leave rows behind, keeping
the five journeys order-independent under `make test-e2e`.

## Verification

**Commands:**
- `make lint` -- expected: Ruff check and format plus `tsc --noEmit` exit zero.
- `make test-backend` -- expected: the new mapping and leakage tests pass; `coverage report` ≥70%.
- `make test-frontend` -- expected: the retry, fallback and mutation-error cases pass; lines ≥70%.
- `make test-e2e` -- expected: all five journeys pass and the profile is torn down with `--volumes`.
- `make ci` -- expected: the full chain green.
- `grep -rn "JSONResponse\|HTTPException" backend/app/routers` -- expected: no match, proving no route
  builds an error response inline.
- `grep -rn "'[A-Z][a-z].*\.'" frontend/src --include=*.ts --include=*.tsx | grep -v test` -- expected:
  `NETWORK_ERROR_MESSAGE` is the only user-facing sentence the client authors.
- `git diff story-1.5-intentional-empty-state -- frontend/src/styles` -- expected: only `var(--...)`
  values already defined in `tokens.css`; no hex literal.
- `gh pr checks` on the opened pull request -- expected: the CI workflow concludes success.

**Manual checks (if no CLI):**
- With the backend stopped and the app open, submit a todo: the typed text survives, the message is
  comprehensible to a non-developer; restart the backend and click retry — the board recovers without
  a page reload.

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change**

Story 1.6 closes the epic. The backend's AD-4 contract already held from 1.1 — one envelope, three
codes, handler-produced only — so this slice pins it rather than rewriting it: an exhaustive
`AppError` → (status, code) walk over the imported subclass tree, a forced service failure driven
through the *shipped* `GET /api/todos` route, and a leakage case proving the 500 body carries no
stack trace, SQL, file path, dependency version or request echo while the log keeps all of it. The
real production work is on the client, where a failed load previously left the user with a dead-end
alert: `useTodos` now owns a `load()` guarded by an in-flight ref and exposes it as `retry()`, so a
re-entrant activation coalesces onto the running promise instead of issuing a second fetch, and `App`
renders the message and an Enter-operable `Retry` button as one announced unit. The loading line is
suppressed while an error is on screen, so retrying with rows present keeps both columns mounted
instead of blanking the board and stacking two live regions.

**Files changed**

- `frontend/src/hooks/useTodos.ts` — the mount fetch extracted into `load()` with `mounted` and
  `inFlight` refs, exposed as `retry`; `setError(null)` on a successful load. Mutation paths untouched.
- `frontend/src/App.tsx` — the error region is a `div[role="alert"]` holding `<span>{error}</span>`
  and a `<button type="button">Retry</button>`; the loading line renders only when no error is shown.
- `frontend/src/styles/app.css` — `.state-line-error` as a wrapping flex row with a nested button
  rule; existing class names and `var(--token)` values only.
- `backend/tests/test_errors.py` — the exhaustive mapping walk, with `app.main` imported to force
  subclass registration.
- `backend/tests/test_health.py` — the forced-500 leakage/log split, plus the same failure driven
  through the real route with the router's `list_todos` monkeypatched.
- `frontend/src/hooks/useTodos.test.ts` — retry recovery, retry coalescing, the network fallback, and
  an unmount-while-pending case that records setter calls so the guards are load-bearing.
- `frontend/src/App.test.tsx` — the failed-load case grown to the retry control, retry recovery by
  mouse and Enter, the in-flight disabled case, and the three mutation-failure cases extended.
- `e2e/tests/error-handling.spec.ts` — the single new journey, `page.route`-only, persisting nothing.
- `qa/story-1.6.md` — the five agentic checks with evidence and mutation tables.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 1.6 moved to `review`.

**Review findings**

Patches applied: 15 (medium 4, low 11). Deferred: 2 (low 2) — the optimistic-row/retry duplication
window and the focus drop when the retry button disables or the alert unmounts. Rejected: 12, all low.

Follow-up review recommended: **true** — patched severities were 0 high, 4 medium, 11 low, scoring
3 x 4 + 1 x 11 = 23, at or above the threshold of 5.

**Verification**

`make ci` exits 0 after the patches: Ruff check and format clean, `tsc --noEmit` clean, backend 43
passed with coverage 99% (212 statements, 2 missed), frontend 33 passed with 94.53% lines and 92.59%
branches, and all five Playwright journeys green against the `test` profile, torn down with
`--volumes`. `grep -rn "JSONResponse\|HTTPException" backend/app/routers` is empty, so every non-2xx
body comes from the handlers in `main.py`; `NETWORK_ERROR_MESSAGE` is still the only sentence the
client authors; the styles diff adds no hex literal. Every one of the twelve I/O matrix rows is
covered by a test that ran and passed. CI is green on PR #6 (run 33267743523), which targets
`story-1.5-intentional-empty-state` per the epic's stacked-PR rule.

**Residual risks**

- The E2E journey fabricates both the failing and the succeeding response with `page.route`, as the
  epic's own test row prescribes, so no automated test joins a real backend error to a rendered
  message; that end-to-end path is evidenced only by the agentic checks in `qa/story-1.6.md`.
- The two deferred items above remain open, as does the suite-wide absence of axe-core assertions in
  the Playwright journeys carried over from story 1.5.
- `retry()` re-lists the board rather than re-issuing a failed mutation, which is the accepted reading
  of the epic's "dismissible or self-clearing" AC but is not what the word "Retry" promises next to a
  failed create.
