---
title: 'Story 1.4 — Complete and Delete a Todo'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '9bd5174b551dfe5bb76242fb041ebd45b754e861'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      Rows are never marked pending while a toggle or delete is in flight, so a double-click
      fires two mutations on the same row and a late failure can roll back over the user's
      newer intent.
    evidence: |-
      toggleTodo and deleteTodo apply optimistically but never set `pending: true`, so
      TodoRow's `disabled={todo.pending}` never engages for these paths and the hook's own
      `row.pending` guard is unreachable. If a second toggle on the same id is confirmed and
      the first PATCH then rejects, the revert writes the stale captured value back. Consequence
      is bounded — a single-user local board, corrected by any reload — and the fix (marking the
      row pending for the duration of the call) changes the mid-flight control affordance, which
      is Story 1.6's surface.
    location: >-
      frontend/src/hooks/useTodos.ts:99
    severity: medium
  - summary: >-
      A completed row's label renders --color-text-done #555555 on #000000 at 2.81:1, under the
      4.5:1 WCAG AA bar.
    evidence: |-
      axe-core reports two color-contrast nodes on a board carrying completed rows. The token
      predates this story (recorded in qa/story-1.2.md) and no new hex was added here, but this
      story makes it reachable from the UI for the first time. It is a token-level decision owned
      by UX, and the epic makes AA a stretch goal rather than a gate.
    location: >-
      frontend/src/styles/tokens.css
    severity: low
---

<intent-contract>

## Intent

**Problem:** The board can be read and appended to, but nothing can change or leave it: there is no
`PATCH /api/todos/{id}` and no `DELETE /api/todos/{id}`, and `TodoRow`'s checkbox is `readOnly` while
its `×` button has no handler. The epic's mutate slice (FR-5, FR-6, FR-7) is missing.

**Approach:** Extend the same files the read and create slices already occupy — one `PATCH` and one
`DELETE` route over a `TodoUpdate` schema carrying only `completed`, with a `NotFoundError` raised in
the service layer for an unknown id, and `toggleTodo`/`deleteTodo` in `useTodos` applying the AD-6
sequence per row and reverting only the affected todo, wired into `TodoRow` through props.

## Boundaries & Constraints

**Always:**
- Layering holds both sides: `routers → services → repository → models` and `components → hooks/useTodos → api/client`. Every SQL expression and every session mutation stays in `repository.py`; every request stays in `api/client.ts`; `useTodos.ts` remains the only holder of todo state and the only caller of the client.
- `completed` is the only field the update endpoint accepts; `description`, `id`, `createdAt` and `userId` are immutable and unreachable through mass assignment.
- An unknown id answers `404 {"error":"NOT_FOUND","message":"..."}` through the `AppError` handler already registered in `main.py` — raised as `NotFoundError` from the service, never constructed in a route.
- Both mutations are scoped through `current_scope` (AD-15): a lookup for another owner is a 404, not a cross-owner write.
- Rollback is per-todo: the toggled row returns to its exact prior `completed` value and the deleted row reappears in its original position. No whole-list snapshot is taken anywhere, so a concurrent add or toggle is never undone.
- Failures surface a recoverable message through the existing `error` alert; `setError(null)` clears it on the next success.
- Design tokens only (`var(--token)`), no new hex, no new heading levels. The `×` keeps `--color-control` / `--color-control-hover`, never accent, never red.
- `DELETE` returns `204` with no body; `request<void>` already handles a 204 by returning `undefined`.

**Block If:**
- `make ci` fails for a reason outside this story's change surface.
- The `404` for an unknown id cannot be produced through the existing `main.py` `AppError` handler without adding a second error path.

**Never:**
- Do not add tests beyond the epic's Story 1.4 test table — that table is the complete test scope. No extra unit tests (the table's unit row is explicitly `none`), no extra component cases, no second E2E journey.
- Do not touch the empty state (1.5) or retry/undo affordances (1.6); there is no undo in v1.
- No soft delete, no PUT, no bulk endpoint, no test-only route, no migration tool, no CORS, no absolute API URL.
- Do not re-filter or re-sort in components; `useTodos` stays the sole partitioner.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Toggle complete | `PATCH /api/todos/{id}` `{"completed": true}` | `200` with the updated todo, `completed: true`, `description` and `createdAt` unchanged | No error expected |
| Toggle back | `PATCH` `{"completed": false}` on a done todo | `200`, `completed: false` | No error expected |
| Description immutable | `PATCH` `{"completed": true, "description": "hacked"}` | `200`; stored `description` unchanged, and no extra field reaches the model | Extra keys ignored by `TodoUpdate` |
| Bad update body | `PATCH` `{}`, `{"completed": "yes-ish"}`, or non-JSON | `400 VALIDATION_ERROR` in the one envelope, never `422` | `RequestValidationError` handler |
| Update unknown id | `PATCH /api/todos/does-not-exist` | `404 {"error":"NOT_FOUND","message":"..."}` | `NotFoundError` → `AppError` handler; no path, SQL or stack trace |
| Delete success | `DELETE /api/todos/{id}` | `204`, empty body, row hard-deleted and absent from a later `GET /api/todos` | No error expected |
| Delete unknown id | `DELETE /api/todos/does-not-exist` | `404 NOT_FOUND` in the same envelope | Same handler |
| Optimistic toggle | Click a TODO checkbox | Row moves to DONE with strikethrough before confirmation; `updateTodo` called exactly once | — |
| Optimistic delete | Click a row's `×` | Row disappears before confirmation; `deleteTodo` called exactly once | — |
| Toggle rollback | Stubbed `updateTodo` rejection | Only that row returns to its original column; a concurrently mutated second todo keeps its new state; alert shows the server message | `ApiRequestError.message`, else the one local network string |
| Delete rollback | Stubbed `deleteTodo` rejection | The row reappears at its original index; other rows untouched; alert shown | Same |

</intent-contract>

## Code Map

Backend (under `backend/`):
- `app/schemas.py:31-39` -- `TodoCreate`/`TodoRead` and the `ApiSchema` camelCase base. Add `TodoUpdate(ApiSchema)` with a single `completed: bool`; no per-field aliases, no `description` field (its absence is what makes description immutable).
- `app/repository.py:10-22` -- `list_todos` and `create_todo` are the layer's pattern. Add `get_todo(session, todo_id, owner)` (a scoped `select(...).where(Todo.id == ..., col(Todo.user_id) == owner)`), plus `update_completed(session, todo, completed)` (assign, `add`, `flush`, `refresh`) and `delete_todo(session, todo)` (`session.delete`). Never commit here — `db.get_session:123-132` commits on success and rolls back on failure.
- `app/services.py:21-26` -- delegation only. Add `set_completed` and `delete_todo`, each fetching via `repository.get_todo` and raising `errors.NotFoundError("Todo not found.")` when the row is missing. This is the only place the 404 originates.
- `app/errors.py:10-12` -- `NotFoundError` already exists with `code = "NOT_FOUND"`, `status_code = 404`. Reuse; do not add a class.
- `app/routers/todos.py:18-25` -- `SessionDep`/`OwnerDep` and the two existing routes. Add `PATCH "/{todo_id}"` (`response_model=TodoRead`) and `DELETE "/{todo_id}"` (`status_code=204`, `response_class=Response`, returning `None`).
- `app/main.py:39-44` -- the `AppError` handler already renders `{error, message}` at `exc.status_code`. Verify, do not duplicate.
- `backend/tests/test_todos_api.py:13-24` -- `seed()` and the assertion style; extend this file with the five Story 1.4 backend rows rather than adding a parallel one. `conftest.py`'s temp-file `engine` and async `client` fixtures are reused verbatim.

Frontend (under `frontend/`):
- `src/api/client.ts:47-53` -- `listTodos`/`createTodo` are the shape to copy. Add `updateTodo(id, completed)` (`PATCH`, body `{completed}`) and `deleteTodo(id)` (`DELETE`, `request<void>`; the `204` branch at `:40-42` already returns `undefined`).
- `src/hooks/useTodos.ts:57-95` -- `addTodo` is the AD-6 template. Add `toggleTodo(id)` and `deleteTodo(id)`: read the row from the functional-update callback (never from a captured snapshot), apply optimistically, call the client, revert only that row on failure and `setError(messageOf(caught))`; clear `error` on success. Deletion must remember the row's index so the revert re-inserts in place. Both must ignore rows still `pending`.
- `src/components/TodoRow.tsx:7-23` -- the checkbox is `readOnly` and the `×` has no handler. Take `onToggle`/`onDelete` props and wire them; keep both disabled while `todo.pending`, keep the `Delete` accessible name and the `Mark complete`/`Mark incomplete` names.
- `src/components/TodoColumn.tsx:10-23` -- pass the two callbacks straight through; it must keep filtering and sorting nothing.
- `src/App.tsx:5-29` -- pull `toggleTodo`/`deleteTodo` off the hook and hand them to both `TodoColumn`s; the alert, loading and column blocks stay as they are.
- `src/styles/app.css:105-139,164-171` -- the checkbox, `.row .btn-icon` control tokens and the pending-disabled rules are already authored. No CSS change is expected; add one only if a real gap appears, from existing tokens.
- `src/App.test.tsx:10-32` -- the `vi.mock('./api/client', importOriginal)` pattern with per-test `mockReset`; extend the factory with `updateTodo`/`deleteTodo` for the six frontend rows.
- `e2e/tests/create-todo.spec.ts:6-29` -- the `py(CLEAR)` docker-exec helper and the self-resetting `beforeAll`/`afterAll`; copy it into `complete-and-delete.spec.ts`, which seeds through the API rather than the UI.
- `qa/story-1.3.md` -- the report format (verdict table, then one section per check with evidence) to follow for `qa/story-1.4.md`.
- `Makefile:23-49` -- `lint`, `coverage`, `test-e2e`, `ci`. Unchanged; new tests must run under the existing targets.

## Tasks & Acceptance

**Execution:**
- `backend/app/schemas.py` -- add `TodoUpdate(ApiSchema)` with only `completed: bool` -- AD-10, FR-7 immutability by construction.
- `backend/app/repository.py` -- add `get_todo` (scoped by owner), `update_completed`, `delete_todo`; no commit -- AD-9, AD-12.
- `backend/app/services.py` -- add `set_completed` and `delete_todo`, both raising `NotFoundError` on a missing row -- AD-1, AD-4.
- `backend/app/routers/todos.py` -- add `PATCH "/{todo_id}"` returning `TodoRead` and `DELETE "/{todo_id}"` returning `204` with no body, both taking the owner from `current_scope` -- AD-2, AD-15.
- `backend/tests/test_todos_api.py` -- the epic's five backend integration rows: PATCH both directions, PATCH unknown id → 404 envelope, PATCH leaves `description` unchanged, DELETE → 204 and absent from a later list, DELETE unknown id → 404.
- `frontend/src/api/client.ts` -- add `updateTodo(id, completed)` and `deleteTodo(id)` -- AD-5, the only request site.
- `frontend/src/hooks/useTodos.ts` -- add `toggleTodo` and `deleteTodo` following the AD-6 sequence with per-row revert (delete restores by original index) -- AD-6, FR-5, FR-6.
- `frontend/src/components/TodoRow.tsx` -- make the checkbox interactive and wire the `×`, both through props, both disabled while pending -- AD-1, UX-DR5.
- `frontend/src/components/TodoColumn.tsx` -- thread the callbacks through unchanged in behaviour -- AD-1.
- `frontend/src/App.tsx` -- wire the hook's two new callbacks into both columns -- FR-5, FR-6.
- `frontend/src/App.test.tsx` -- the epic's six frontend integration rows: optimistic toggle (moves columns immediately, client called once), optimistic delete, toggle rollback, delete rollback, and the anti-snapshot guard asserting both rollbacks leave a second concurrently-mutated todo untouched.
- `e2e/tests/complete-and-delete.spec.ts` -- the epic's single journey: seed via the API, check → DONE, uncheck → TODO, check again, delete, reload, gone; self-resetting and order-independent.
- `qa/story-1.4.md` -- the agentic QA report with a verdict and evidence for each of the five checks (performance, coverage, accessibility, security, functional-in-Chrome).

**Acceptance Criteria:**
- Given the backend source, when searched for `select(`, `session.add(`, `session.delete(` and `.commit()`, then every query and mutation is inside `repository.py` and the only `commit()` is in `db.py`.
- Given the backend source, when searched for `NOT_FOUND`, then it appears only in `errors.py` (and tests) — no route or service constructs an envelope inline.
- Given `TodoUpdate`, when a `PATCH` body carries `description` or `userId`, then the value never reaches the model and the stored row is unchanged apart from `completed`.
- Given `useTodos.ts`, when read, then no whole-list snapshot is captured before a mutation and each revert targets exactly one id; given `TodoRow.tsx`, then it imports neither the API client nor the hook's functions and only invokes props.
- Given a row whose optimistic create has not confirmed, when its controls are inspected, then the checkbox and `×` are disabled so no mutation can be issued against a temp id.
- Given the board at 320px and at 1280px, when a row is toggled or deleted, then nothing clips or shifts, the `×` stays neutral gray with a lighter hover, and focus is neither lost nor trapped when the row leaves the DOM.
- Given `make ci`, when it runs, then lint, both suites with their ≥70% line gates, and all three Playwright journeys pass.
- Given the story is complete, when the work is published, then a branch cut from `story-1.3-add-a-todo` carries the change, a pull request targets that branch naming the story, FR-5/FR-6/FR-7 and the ADs to spot-check (AD-1, AD-2, AD-4, AD-5, AD-6, AD-9, AD-15, AD-16), and `qa/story-1.4.md` records the five agentic checks.

## Spec Change Log

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 4, low 2)
- defer: 2: (high 0, medium 1, low 1)
- reject: 22: (high 0, medium 0, low 22)
- addressed_findings:
  - `[medium]` `[patch]` The PATCH tests asserted only the response body, which is serialized from
    the same in-memory object the service just mutated, so a non-durable update would have shipped
    green. The fresh-session read-back now asserts `completed`; mutation-verified against an
    `update_completed` that returns a detached copy.
  - `[medium]` `[patch]` The owner predicate in `repository.get_todo` is the change's only
    authorization boundary and nothing covered it — dropping it left the suite green, and it would
    let any user mutate any todo by id the moment `current_scope` returns a real id. The existing
    cross-owner test now PATCHes and DELETEs the `user_id='other'` row, expecting the 404 envelope
    and the row's survival; mutation-verified.
  - `[medium]` `[patch]` `setError(null)` on the toggle and delete success paths was asserted by
    nothing, so deleting it stranded the red alert on the board for the rest of the session. Both
    rollback cases now continue into a succeeding retry and assert the alert is gone;
    mutation-verified on each path.
  - `[medium]` `[patch]` `moveFocusOut` exists to satisfy the "focus neither lost nor trapped when
    a row leaves the DOM" criterion, but no test referenced focus at all — removing the call left
    everything green while focus dropped to `<body>`. The optimistic-delete case now asserts the
    neighbouring `Delete` holds focus; mutation-verified.
  - `[low]` `[patch]` `repository.delete_todo` issued `session.delete` with no `flush`, unlike its
    siblings, so an integrity failure would raise at commit time outside the service and surface as
    a bare 500 rather than the AD-4 envelope. Added `session.flush()`.
  - `[low]` `[patch]` `qa/story-1.4.md` claimed five backend integration cases and 35 passing tests,
    which no longer described the tree it audits. Corrected to the real accounting (38 backend
    cases, the two closing the matrix's malformed-update-body row, the owner extension) and moved
    the four mutants patches 1-4 now kill out of the not-covered list.

Also patched before the review pass: the I/O matrix's "Bad update body" row had no covering test, so
a parametrized `{}` / `{"completed": "yes-ish"}` case and a non-JSON case were added to close the
matrix audit.

Rejected as noise or out of scope on the intent's authority: per-row aria-labels and success live-region
announcements (the epic fixes the microcopy at `Delete`/`Add todo` and mandates no extra copy), an undo
affordance and a delete confirmation (explicitly none in v1), `If-Match`/`updatedAt` optimistic
concurrency and a PATCH-response reconciliation (v1 echoes what it was sent), `encodeURIComponent` on
server-generated UUID ids, OpenAPI 400/404 documentation (already rejected in 1.3), a shared E2E reset
fixture and the `×` glyph in E2E assertions (pre-existing conventions from 1.2/1.3), `flushSync` and
updater-purity preferences (React invokes the updater with the same base state, so the captured value
is idempotent, and live Chrome confirms the behaviour), a repeat-DELETE idempotency test and
forged-`id` mass-assignment tests (both already answered by the unknown-id and extra-field rows),
delete-index staleness and focus restoration on a failed delete, docker-availability guards in the E2E
helper, and several naming and test-hygiene preferences.

## Design Notes

**Where the 404 comes from.** The service fetches through `repository.get_todo` and raises
`errors.NotFoundError`; `main.py`'s `AppError` handler turns it into `404 {"error":"NOT_FOUND", ...}`.
The route never inspects the result and never builds a body:

```python
def set_completed(session: Session, todo_id: str, completed: bool, owner: str | None) -> Todo:
    todo = repository.get_todo(session, todo_id, owner)
    if todo is None:
        raise NotFoundError("Todo not found.")
    return repository.update_completed(session, todo, completed)
```

**Per-row optimistic revert.** Both mutations read and write inside the functional updater so a
concurrent mutation is never clobbered. Delete captures its index at removal time and splices the row
back on failure:

```ts
setTodos((current) => {
  index = current.findIndex((row) => row.id === id)
  removed = current[index]
  return current.filter((row) => row.id !== id)
})
// on failure:
setTodos((current) => [...current.slice(0, index), removed, ...current.slice(index)])
```

**E2E self-reset.** `complete-and-delete.spec.ts` seeds through the API (`request.post('/api/todos')`)
and clears with the same `py(CLEAR)` helper in `beforeAll`/`afterAll`, so the three journeys stay
order-independent under `make test-e2e`, which tears the profile down with `--volumes`.

## Verification

**Commands:**
- `make lint` -- expected: Ruff check and format plus the frontend typecheck exit zero.
- `make test-backend` -- expected: the five new backend rows pass alongside 1.1–1.3; `coverage report` stays ≥70%.
- `make test-frontend` -- expected: the six new frontend cases pass; line coverage ≥70%.
- `make test-e2e` -- expected: all three journeys pass and the profile is torn down.
- `make ci` -- expected: the full chain is green.
- `grep -rn 'select(\|session.add(\|session.delete(\|\.commit()' backend/app` -- expected: queries and mutations only in `repository.py`; the only `commit()` is in `db.py`.
- `grep -rn 'fetch(' frontend/src --include='*.ts' --include='*.tsx' | grep -v test` -- expected: only `api/client.ts`.
- `curl -s -X PATCH localhost:8000/api/todos/<id> -H 'Content-Type: application/json' -d '{"completed":true,"description":"hacked"}'` -- expected: `200` with `completed: true` and the original description.
- `curl -s -o /dev/null -w '%{http_code}' -X DELETE localhost:8000/api/todos/<id>` -- expected: `204`, then a repeat returns `404` with the envelope and no stack trace.

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change**

The mutate half of the todo CRUD API and the row controls that drive it. `PATCH /api/todos/{id}`
accepts a `TodoUpdate` carrying only `completed`, so description immutability holds by construction
rather than by a guard; `DELETE /api/todos/{id}` hard-deletes and answers `204` with no body. Both
resolve the row through one owner-scoped `repository.get_todo`, and both raise `NotFoundError` from
the service for an unknown or foreign id, so the single `AppError` handler already registered in
`main.py` produces the one `404 NOT_FOUND` envelope. On the client, `updateTodo`/`deleteTodo` join
`api/client.ts` as the only other request sites, and `useTodos` gained `toggleTodo` and `deleteTodo`
applying the AD-6 sequence with a strictly per-row revert — the toggle restores the exact prior
`completed`, the delete splices the row back at its captured index — so a concurrently mutated todo
is never undone. `TodoRow` became interactive through props only, handing focus to a neighbour before
the optimistic removal unmounts it.

**Files changed**

- `backend/app/schemas.py` — `TodoUpdate` with a single `completed: bool`.
- `backend/app/repository.py` — `get_todo` (owner-scoped), `update_completed`, `delete_todo`; flush, never commit.
- `backend/app/services.py` — `set_completed` and `delete_todo`, the sole origin of the 404.
- `backend/app/routers/todos.py` — `PATCH /{todo_id}` → `TodoRead`, `DELETE /{todo_id}` → 204.
- `backend/tests/test_todos_api.py` — the epic's five backend rows, the matrix's malformed-body row, and cross-owner mutation coverage.
- `frontend/src/api/client.ts` — `updateTodo(id, completed)` and `deleteTodo(id)`.
- `frontend/src/hooks/useTodos.ts` — `toggleTodo`/`deleteTodo` with per-row revert; no whole-list snapshot.
- `frontend/src/components/TodoRow.tsx` — interactive checkbox and `×` through props, plus the focus hand-off.
- `frontend/src/components/TodoColumn.tsx`, `frontend/src/App.tsx` — callbacks threaded through.
- `frontend/src/App.test.tsx` — the epic's six frontend rows, extended with alert-clearing and focus assertions.
- `e2e/tests/complete-and-delete.spec.ts` — the epic's single journey, API-seeded and self-resetting.
- `qa/story-1.4.md` — the five agentic checks with evidence and mutation proofs.

**Review findings**

Patches applied: 6 (medium 4, low 2). Deferred: 2 (medium 1, low 1) — the missing in-flight `pending`
mark, and the carried-over `--color-text-done` contrast token. Rejected: 22, all low.

Follow-up review recommended: **true** — patched severities were 0 high, 4 medium, 2 low, scoring
3 × 4 + 1 × 2 = 14, at or above the threshold of 5.

**Verification**

`make ci` exits 0 after the patches: lint (Ruff check, Ruff format, `tsc --noEmit`), backend 38 passed
with coverage 99% (212 statements, 2 missed), frontend 23 passed with 93.91% lines, and all three
Playwright journeys green against the `test` profile, torn down with `--volumes`. The spec's
acceptance greps hold: queries and mutations only in `repository.py` with the sole `commit()` in
`db.py`, `NOT_FOUND` only in `errors.py`, and the sole `fetch(` in `api/client.ts`. Every I/O matrix
row is covered by a test that ran and passed. Each of the four test-level patches was mutation-verified
— the covering assertion fails when the behaviour it guards is removed.

**Residual risks**

- The route's own `current_scope` wiring cannot be distinguished from `None` at the test layer while
  v1's scope is always `None`; the repository predicate beneath it is now covered and the end-to-end
  behaviour is curl-verified.
- Concurrent mutations on the *same* row are unguarded — see the first deferred item.
- A completed row's label is below the AA contrast bar — see the second deferred item; token-level and
  owned by UX.
