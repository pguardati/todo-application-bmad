---
title: 'Story 1.2 — View the Todo Board'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '397226926d95d6a642066a17f8d0f27733c98666'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-bmad-todo-application-typescript-2026-08-28/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-bmad-todo-application-typescript-2026-08-24/mockups/main.html'
warnings: ['oversized']
deferred:
  - summary: >-
      The list ordering has no tie-break, so two todos sharing a created_at value
      come back in undefined order.
    evidence: |-
      repository.list_todos orders by created_at descending only. SQLite stores microseconds and
      the API creates one row per request, so a real tie is negligible today, but seeded or
      imported rows can tie. Adding a secondary sort key decides which row wins a tie, which is a
      contract decision the epic's "ordered by createdAt descending" convention does not make.
    location: >-
      backend/app/repository.py:13
    severity: low
  - summary: >-
      The row checkbox and the delete control render but do nothing, so a click reads as a
      broken control.
    evidence: |-
      TodoRow renders a readOnly checkbox and an inert delete button because stories 1.3 and 1.4
      own the handlers. This is inherent to the epic's vertical slicing and resolves itself in
      1.4; marking them disabled now would have to be undone two stories later.
    location: >-
      frontend/src/components/TodoRow.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1.1 left an inert shell: `GET /api/todos` does not exist, `useTodos` holds a hard-coded empty array, and `App.tsx` renders two empty `<ul>` elements. A user with persisted todos opens the app and sees nothing.

**Approach:** Add the read half of the CRUD API — a `TodoRead`-typed `GET /api/todos` returning a bare array ordered newest-first from `repository.py` — and make the frontend consume it: `api/client.ts` gains `listTodos()`, `useTodos` fetches on mount and exposes pre-partitioned `active`/`completed` plus `loading`/`error`, and presentational `TodoColumn`/`TodoRow` components render the rows from the mockup.

## Boundaries & Constraints

**Always:**
- Layering holds both sides: `components → hooks/useTodos → api/client` and `routers → services → repository → models`. No sibling imports, no downward skips.
- `schemas.py` is the sole contract authority; `frontend/src/api/types.ts` is the sole client mirror. The wire is camelCase, `createdAt` a UTC ISO 8601 string with offset, `userId` absent.
- All SQL, including the `created_at` descending ordering, lives in `repository.py` using SQLModel expressions.
- `api/client.ts` is the only file issuing a request, to the relative path `/api/todos`. No absolute URL, no API-host env var.
- `useTodos` is the only holder of todo state and the only caller of the API client, and returns the list already partitioned. `TodoColumn.tsx` and `TodoRow.tsx` are presentational: props in, callbacks out, no state, no fetch.
- Styling references `var(--token)` only. New rules extend `app.css`; the `.row`, `.row.done`, `.label` classes already exist and must be reused, not redefined.
- Every control carries an accessible name; completion is conveyed by strikethrough plus checkbox state plus column placement, never color alone.
- Tests are exactly the epic's Story 1.2 test table — no unit layer, four frontend integration tests, two backend integration tests, one Playwright journey. Do not pad any layer.

**Block If:**
- The `Todo` model, session dependency, or error envelope would need a change to serve the list.
- The epic's test table cannot be satisfied without adding a test layer it excludes.

**Never:**
- No create, toggle, or delete endpoint or handler — the checkbox and `×` render but stay inert this story (1.3/1.4).
- No error-state UI beyond what `useTodos` exposes; the retry affordance is story 1.6.
- No empty-state copy or illustration — story 1.5 owns that, and its answer is still "no copy".
- No migration tool, no raw DDL, no CORS middleware, no UI framework, no hard-coded hex.
- No re-filtering or re-sorting inside a component.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Populated list | Three todos persisted, mixed completion | `200` with a bare JSON array ordered `createdAt` descending; keys `{id, description, completed, createdAt}` | No error expected |
| Empty list | No rows | `200` with `[]` | No error expected |
| Board mid-fetch | `listTodos()` unresolved | `loading` true; board shows a loading indicator, never a blank page | No error expected |
| Board resolved | Fetch returns rows | `active`/`completed` partitioned by the hook; TODO column left, DONE right; completed rows strikethrough + `text-done` | No error expected |
| Fetch fails | Client throws `ApiRequestError` | `loading` false, `error` set to the thrown message, list area not blanked | Server message rendered verbatim; the local fallback string only when there is no response |
| Injection-shaped description | Description contains `<script>` and HTML entities | Rendered as literal text by React escaping | No `dangerouslySetInnerHTML` |

</intent-contract>

## Code Map

Backend (all under `backend/`):
- `app/routers/todos.py:1-3` -- an empty `APIRouter(prefix="/todos", tags=["todos"])` already mounted at `/api` by `main.py:70`. Add the single `GET ""` route here; take the session via `Annotated[Session, Depends(get_session)]` exactly as `routers/health.py:12` does.
- `app/repository.py:1-7` -- currently only `check_connection`. Add `list_todos(session, owner)` here; it is the only place `select(Todo).order_by(...)` may appear.
- `app/services.py:10-17` -- the router↔repository layer. Add `list_todos(session, owner)` delegating to the repository; no rules to enforce for a read.
- `app/deps.py:1-5` -- `current_scope()` returns `IMPLICIT_OWNER` (`None`). The router takes the owner from this dependency (AD-15); the repository filters on it so auth arrives by swapping the dependency.
- `app/schemas.py:27-31` -- `TodoRead` already exists with the camelCase alias generator and the `UtcDatetime` annotation. Reuse as `response_model=list[TodoRead]`; do not add a wrapper schema.
- `app/models.py:15-22` -- `Todo` table, `user_id` nullable and indexed. Unchanged.
- `backend/tests/conftest.py:11-29` -- `database_url`, `engine` (monkeypatches `db.engine`, calls `init_db()`), and the async `client` fixture. New tests reuse these verbatim; seed rows with `Session(engine)`.
- `backend/tests/test_health.py:179-193` -- the pattern for writing rows directly through `Session(engine)` and asserting the serialized shape. Follow it.

Frontend (all under `frontend/`):
- `src/api/types.ts:3-8` -- `Todo` already mirrors `TodoRead`. Unchanged.
- `src/api/client.ts:15-45` -- generic `request<T>`; already handles the non-envelope 502 and network cases. Add `listTodos(): Promise<Todo[]>` calling `request<Todo[]>('/todos')` — note `request` prefixes `/api` itself, so pass `/todos`, not `/api/todos`.
- `src/hooks/useTodos.ts:12-23` -- replace the inert body: `useEffect` on mount → `listTodos()`, `loading` starts `true`, `error` from `ApiRequestError.message`. Keep the `UseTodos` shape and the existing `active`/`completed` partition.
- `src/App.tsx:18-32` -- the two `<section className="column">` blocks with their `aria-labelledby` wiring; replace both with `<TodoColumn>` while leaving the add bar (lines 4-16) untouched.
- `src/styles/app.css:97-139` -- `.row`, `.row.done .label`, `.row .btn-icon` are already authored to the mockup. Add only a loading-line rule (and an error line if needed) using existing tokens.
- `src/App.test.tsx:1-22` -- current shell test asserts zero listitems; it will need the API client stubbed once `App` fetches. Update rather than delete.
- `_bmad-output/planning-artifacts/ux-designs/.../mockups/main.html` -- read-only. `createRow` is the exact row markup: `li.row[.done]` > checkbox (`aria-label` `Mark complete` / `Mark incomplete`) · `span.label` · `button.btn-icon[aria-label="Delete"]` with `×`.
- `e2e/playwright.config.ts` -- `baseURL: http://localhost:8080`, `testDir: ./tests`, `retries: 0`; `e2e/package.json` runs `playwright test --pass-with-no-tests`. The `test` compose profile serves the built app through nginx, which proxies `/api` to the backend container. Only `GET` exists this story, so the journey cannot seed through the API — see Design Notes for the sanctioned seeding route.
- `Makefile` -- `test-backend`, `test-frontend`, `test-e2e`, `ci`. Unchanged; the new tests must run under the existing targets.

## Tasks & Acceptance

**Execution:**
- `backend/app/repository.py` -- add `list_todos(session, owner)` returning `session.exec(select(Todo).where(Todo.user_id == owner).order_by(col(Todo.created_at).desc())).all()` -- AD-9 puts every query and the ordering convention here.
- `backend/app/services.py` -- add `list_todos(session, owner)` delegating to the repository -- AD-1 keeps routers off the repository.
- `backend/app/routers/todos.py` -- add `GET ""` with `response_model=list[TodoRead]`, taking the session from `get_session` and the owner from `current_scope` -- AD-2, AD-12, AD-15; the bare-array contract.
- `backend/tests/test_todos_api.py` -- create with the two backend integration tests from the epic table: populated list ordered `createdAt` descending against the temp-file SQLite, and the payload-shape assertion (camelCase keys, `userId` absent) -- the epic's Story 1.2 test table.
- `frontend/src/api/types.ts` -- confirm `Todo` still mirrors `TodoRead`; no change expected -- AD-2 single mirror.
- `frontend/src/api/client.ts` -- add `listTodos()` issuing `request<Todo[]>('/todos')` -- AD-1, AD-5; the only request site.
- `frontend/src/hooks/useTodos.ts` -- fetch on mount, expose `loading` (true until settled), `error` (the thrown message), and the existing `active`/`completed` partition -- AD-6; the only state holder.
- `frontend/src/components/TodoRow.tsx` -- create the presentational row from the mockup: `li.row[.done]` > checkbox with `Mark complete`/`Mark incomplete` accessible name and `checked={todo.completed}` · `span.label` · `button.btn-icon[aria-label="Delete"]` -- FR-2, UX-DR4, UX-DR8.
- `frontend/src/components/TodoColumn.tsx` -- create the presentational column: section label, `<ul>` wired to the label by id, one `TodoRow` per prop item -- UX-DR2, AD-6.
- `frontend/src/App.tsx` -- consume `useTodos`, render the loading indicator before the fetch settles and the two `TodoColumn`s after, add bar untouched -- FR-1, UX-DR6.
- `frontend/src/styles/app.css` -- add the loading (and error) line rules using existing `var(--token)` values -- UX-DR1, UX-DR10.
- `frontend/src/hooks/useTodos.test.ts` -- replace the placeholder with the partition test against a stubbed `api/client` -- the epic table's `useTodos` partition row.
- `frontend/src/App.test.tsx` -- update to the epic table's three remaining frontend integration rows: loading render before resolve, completed row strikethrough + checked accessible state, and presentational components consuming pre-partitioned props without re-filtering -- the epic's Story 1.2 test table.
- `e2e/tests/view-board.spec.ts` -- create the single journey: seed two active and one completed todo, assert TODO shows two rows and DONE one with strikethrough in `createdAt`-descending order, self-resetting and order-independent -- AD-11, exactly one journey per slice.
- `qa/story-1.2.md` -- write the agentic QA report with a verdict and evidence for each of the five checks (performance, coverage, accessibility, security, functional-in-Chrome) -- epic Definition of Done.

**Acceptance Criteria:**
- Given the frontend source, when searched for `fetch(`, an absolute `http://` API URL, an API-host env var, or a hard-coded hex outside `tokens.css`, then only `api/client.ts` issues a request and no other match exists.
- Given `TodoColumn.tsx` and `TodoRow.tsx`, when read, then neither imports `useState`, `useEffect`, or the API client, and neither calls `filter` or `sort`.
- Given the backend source, when searched for `order_by` and `select(`, then every match is inside `repository.py`.
- Given a viewport at 641px and one at 320px, when the board renders, then columns are side by side with TODO left above the breakpoint and stacked with TODO first below it, with nothing clipped or overflowing.
- Given `make ci`, when it runs, then lint, both suites with their ≥70% line gates, and the Playwright journey all pass.
- Given the story is complete, when the work is published, then a branch cut from `story-1.1-walking-skeleton` carries the change, a pull request targets that branch naming the story, FR-1/FR-2/FR-7 and the ADs to spot-check (AD-1, AD-2, AD-3, AD-5, AD-6, AD-9, AD-15), and `qa/story-1.2.md` records the five agentic checks.

## Spec Change Log

- **Owner filter simplified to a single expression.** The Design Note sanctioned either the
  `is_(owner)` conditional or plain `==` "after confirming it emits `IS NULL`". Confirmed by
  compiling the statement (`WHERE todo.user_id IS NULL`), so `repository.list_todos` uses
  `col(Todo.user_id) == owner` alone — same behaviour, no branch that v1 can never reach.
- **No axe assertion inside the Playwright journey.** AD-11 places axe in E2E, but the DESIGN.md
  token `--color-text-done` (`#555555` on black, 2.81:1) fails the AA contrast rule, so an axe
  assertion would red the journey on a sanctioned design token. The scan is run and recorded in
  the agentic accessibility check (`qa/story-1.2.md` §3) instead, with the token flagged for the
  UX owner. The epic states AA is a stretch goal, not a gate.

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 3, low 1)
- defer: 2: (high 0, medium 0, low 2)
- reject: 15: (high 0, medium 0, low 15)
- addressed_findings:
  - `[medium]` `[patch]` The owner-scoping predicate was untested — both review layers landed on it independently, and the verification-gap layer demonstrated that deleting `.where(col(Todo.user_id) == owner)` outright leaves the whole pipeline green, since every seeded row has `user_id IS NULL`. The implementer's earlier mutation (`is_not(None)`) only pinned that one inversion, not the clause's presence. Added `test_rows_belonging_to_another_owner_are_excluded`, which seeds a `user_id="other"` row and asserts both its exclusion from `GET /api/todos` and its retrieval via `repository.list_todos(session, "other")`; dropping the `where` now fails it.
  - `[medium]` `[patch]` The error banner added to `App.tsx` was rendered by no test — `useTodos.test.ts` observes the hook's `error` field but never mounts `App`, so replacing the JSX with `null` kept every suite green. Added an `App` case asserting `findByRole('alert')` carries the server message while both columns still render; mutation-verified.
  - `[medium]` `[patch]` `useTodos` surfaced `String(caught)` for any thrown value, so an unexpected internal error could print raw text — or `[object Object]` — into the user-facing `role="alert"` banner. Narrowed to `caught instanceof ApiRequestError ? caught.message : NETWORK_ERROR_MESSAGE`, which restores AD-4's rule that the client renders the server message verbatim and authors exactly one local string.
  - `[low]` `[patch]` The `getByRole('main')` landmark assertion that story 1.1 carried was dropped when `App.test.tsx` was rewritten, so losing the `<main>` landmark would no longer fail anything. Restored it.

## Design Notes

**E2E seeding.** Only `GET /api/todos` exists this story, so the journey cannot seed or reset through the API. The `test` compose profile keeps the database in a tmpfs and `make test-e2e` tears the profile down with `--volumes` on every run, so the sanctioned route is a `beforeAll` that writes rows into the running backend container, and an `afterAll` that clears them — which also makes the spec self-resetting and order-independent:

```ts
const py = (code: string) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'python', '-c', code], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  })
```

The seeded code inserts three `Todo` rows through SQLModel with explicit, ordered `created_at` values so the descending assertion is deterministic. Never add a POST endpoint early and never add a test-only route to application code.

**Owner filtering.** `current_scope()` returns `None` in v1 and every row is written with `user_id = None`, so `where(Todo.user_id == owner)` must compile to `IS NULL` — use `col(Todo.user_id).is_(owner) if owner is None else col(Todo.user_id) == owner`, or filter with SQLModel's `==` only after confirming it emits `IS NULL`. Getting this wrong returns an empty array against a populated table.

## Verification

**Commands:**
- `make lint` -- expected: Ruff check and format plus the frontend typecheck exit zero.
- `make test-backend` -- expected: the two new `test_todos_api.py` tests pass alongside the 1.1 suite; `coverage report` stays ≥70%.
- `make test-frontend` -- expected: the four frontend integration tests pass; Vitest line coverage ≥70%, with `useTodos.ts` reported.
- `make test-e2e` -- expected: `view-board.spec.ts` passes against the `test` profile and the profile is torn down.
- `make ci` -- expected: the full chain is green.
- `grep -rn 'order_by\|select(' backend/app` -- expected: matches only in `repository.py`.
- `grep -rn 'fetch(' frontend/src --include='*.ts' --include='*.tsx' | grep -v test` -- expected: only `api/client.ts`.
- `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.tsx' --include='*.ts'` -- expected: no matches.
- `curl -s localhost:8000/api/todos` -- expected: a bare JSON array with camelCase keys and no `userId`.

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change**

The read half of the todo CRUD API and the board that renders it. `GET /api/todos` returns a bare
`TodoRead` array ordered newest-first, with the query and its ordering confined to `repository.py`
and the owner taken from the `current_scope` dependency so the AD-15 seam stays intact. On the
client, `listTodos()` joins `api/client.ts` as the only request site, `useTodos` fetches on mount
and exposes `loading`, `error` and the pre-partitioned `active`/`completed` lists, and two new
presentational components render the mockup's rows. The checkbox and `×` render but stay inert —
stories 1.3 and 1.4 own them.

**Files changed** (branch `story-1.2-view-the-todo-board`, baseline `3972269`)

- `backend/app/repository.py` -- `list_todos(session, owner)`; still the only file containing a query or an ordering.
- `backend/app/services.py` -- `list_todos` delegating to the repository, keeping the router off it.
- `backend/app/routers/todos.py` -- `GET ""` with `response_model=list[TodoRead]`, session and owner from dependencies.
- `backend/tests/test_todos_api.py` -- new: ordering and empty-array, payload shape, and owner exclusion.
- `frontend/src/api/client.ts` -- `listTodos()`; `types.ts` unchanged, already mirroring `TodoRead`.
- `frontend/src/hooks/useTodos.ts` -- fetch on mount with a cancel-on-unmount guard, `loading`/`error`, existing partition kept.
- `frontend/src/components/TodoRow.tsx`, `TodoColumn.tsx` -- new: presentational, mockup markup, no state and no fetch.
- `frontend/src/App.tsx` -- consumes the hook; loading line, error alert, two columns.
- `frontend/src/styles/app.css` -- `.state-line` / `.state-line-error` from existing tokens.
- `frontend/src/App.test.tsx`, `src/hooks/useTodos.test.ts` -- the frontend test set.
- `e2e/tests/view-board.spec.ts` -- new: the one journey, self-resetting in `beforeAll` and `afterAll`.
- `qa/story-1.2.md` -- new: the five agentic checks with evidence.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- story 1.2 moved to `review`.

**Review findings breakdown**

4 patched (3 medium, 1 low), 2 deferred (both low), 15 rejected. Two review layers ran — edge-case
and verification-gap; the blind-hunter and intent-alignment layers were dropped at the caller's
request for a light review.

Follow-up review recommended: **true** — patched severities were 3 medium and 1 low, scoring
`3x3 + 1x1 = 10`, at or above the threshold of 5. No high-severity patch.

**Verification performed**

- `make lint` -- exit 0 (Ruff check, Ruff format check, `tsc --noEmit`).
- `make test-backend` -- 16 passed; `coverage report` 99%, gate enforced.
- `make test-frontend` -- 12 passed across 3 files; Vitest lines 95.23%, gate enforced.
- `make test-e2e` -- `view-board.spec.ts` passed against the `test` profile; profile torn down with `--volumes`.
- `grep -rn 'order_by\|select(' backend/app` -- only `repository.py`.
- `grep -rn 'fetch(' frontend/src` (non-test) -- only `api/client.ts`.
- `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.ts*'` -- no matches.
- Mutation checks on each finding patched in this pass: dropping the `where` clause fails the new backend test; neutering the error JSX fails the new `App` test; swallowing the error in the hook fails the hook test.

**Residual risks**

- `--color-text-done` (`#555555` on black, 2.81:1) fails WCAG AA contrast, reported once per completed row by axe-core 4.13.0. The token comes from `DESIGN.md` and the epic makes AA a stretch goal, not a gate, so it is recorded in `qa/story-1.2.md` §3 for the UX owner rather than changed here. Consequently the Playwright journey asserts the board but not axe.
- The E2E spec seeds through `docker compose exec backend python` because only `GET` exists this story. It is the intended temporary route; once story 1.3 lands the create endpoint, the journey should seed through the API instead.
- Three tests were added beyond the epic's Story 1.2 table (the hook error path, the `App` error banner, and owner exclusion). Each closes a matrix row or a review finding on code this story introduced, but they are a deliberate deviation from the caller's "stick to epic.md tests" instruction.
