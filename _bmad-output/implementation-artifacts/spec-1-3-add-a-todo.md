---
title: 'Story 1.3 — Add a Todo'
type: 'feature'
created: '2026-08-29'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '996747169f4aba8800967762f177af7ed184b904'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred:
  - summary: >-
      A create against an unreachable backend takes about 60 seconds to surface, because nginx
      holds the proxied POST for its default proxy_read_timeout.
    evidence: |-
      Observed in real Chrome with the backend stopped. The behaviour is correct once it arrives —
      only the affected row reverts, the message is recoverable, the typed text is preserved — but
      the pending row sits disabled for a minute with no feedback. The fix is a client-side
      AbortController deadline or an nginx timeout, and it belongs with Story 1.6's retry and
      failure affordances.
    location: >-
      frontend/src/hooks/useTodos.ts:75
    severity: medium
  - summary: >-
      Nothing pins that POST stamps user_id from current_scope, so dropping the owner argument
      leaves every suite green.
    evidence: |-
      repository.create_todo passes user_id=owner. Since current_scope returns None in v1, every
      row is written with a NULL owner either way, so removing the argument changes no observable
      behaviour under the current tests. The read side has
      test_rows_belonging_to_another_owner_are_excluded; the create side has no equivalent. Covering
      it needs a test row the epic's Story 1.3 table does not have, and the user restricted this
      story to that table.
    location: >-
      backend/app/repository.py:17
    severity: medium
  - summary: >-
      The load-effect merge that preserves optimistic rows is not asserted by any test.
    evidence: |-
      Reverting the merge back to setTodos(loaded) leaves all 17 frontend tests green. The
      behaviour was verified in real Chrome with GET /api/todos delayed 15 seconds. Pinning it
      would need a sixth frontend case, which the epic's five-row table does not allow.
    location: >-
      frontend/src/hooks/useTodos.ts:38
    severity: medium
  - summary: >-
      Playwright now runs with fullyParallel false and workers 1, serializing every future spec to
      solve a two-file database collision.
    evidence: |-
      The two journeys share one database and reset it through docker compose exec, so parallel
      workers would interleave their seed and clear helpers. Serializing repo-wide was the minimal
      fix, but per-spec data scoping (a unique owner or id prefix per journey) would restore
      parallelism and stop the cost growing with every added slice.
    location: >-
      e2e/playwright.config.ts:5
    severity: low
---

<intent-contract>

## Intent

**Problem:** The board can only be read. `POST /api/todos` does not exist, the add bar is inert markup, and there is no way to capture a task — the epic's create slice (FR-3, FR-4, FR-7) is missing.

**Approach:** Extend the existing read slice downward and upward in the same files: one `POST /api/todos` route with server-authoritative trim-and-length normalization in `schemas.py`, and one optimistic `addTodo` in `useTodos` driving a new presentational `AddBar` that clears on success and preserves its text on failure.

## Boundaries & Constraints

**Always:**
- Layering holds both sides: `routers → services → repository → models` and `components → hooks/useTodos → api/client`. Every SQL expression stays in `repository.py`; every request stays in `api/client.ts`; `useTodos.ts` remains the only holder of todo state and the only caller of the client.
- Validation is server-authoritative: `schemas.py` trims then enforces 1–200 characters, rejecting regardless of client behaviour. The 200 bound exists once per side — `DESCRIPTION_MAX_LENGTH` in `schemas.py` and in `api/types.ts` — and nowhere else.
- Error bodies come only from the handlers already registered in `main.py`; FastAPI's 422 is remapped to `400 VALIDATION_ERROR` there, never constructed inline in a route.
- Optimistic create inserts at the top of TODO under a client-only temp key, disables that row's controls until confirmed, and never sends the temp key to the API.
- Failure reverts **only** the affected optimistic row — no whole-list snapshot restore — surfaces a recoverable message, and leaves the typed text in the input.
- Design tokens only (`var(--token)`), no new hex, no new heading levels, no placeholder text, no validation copy.
- The new todo is scoped through the `current_scope` dependency (AD-15); `userId` stays out of every response shape.

**Block If:**
- The `TodoCreate` normalizer cannot produce `400 VALIDATION_ERROR` through the existing `main.py` handlers without adding a second error path.
- `make ci` fails for a reason that is not in this story's change surface.

**Never:**
- Do not add tests beyond the epic's Story 1.3 test table — that table is the complete test scope for this story. No extra unit tests, no extra component cases, no second E2E journey.
- Do not touch update or delete (story 1.4), the empty state (1.5), or retry affordances (1.6).
- No new endpoint, no test-only route, no migration tool, no CORS, no absolute API URL, no starter/UI framework.
- Do not make `description` mutable, and do not let a client-supplied `id`, `completed`, `createdAt`, or temp key reach the model.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create success | `POST /api/todos {"description": "  Buy milk  "}` | `201` with `{id, description: "Buy milk", completed: false, createdAt}`; UUIDv4 id and server clock; row heads `GET /api/todos` | No error expected |
| Boundary lengths | 1-char and 200-char descriptions | Both accepted, `201` | No error expected |
| Empty / whitespace | `""` or `"   "` | `400 {"error":"VALIDATION_ERROR","message":"..."}` | Handler-produced envelope, no stack trace or echo |
| Over length | 201 characters after trim | `400 VALIDATION_ERROR` | Same envelope |
| Malformed body | `{}`, wrong type, or non-JSON | `400 VALIDATION_ERROR`, never FastAPI's `422` | `RequestValidationError` handler in `main.py` |
| Client rejects early | Submit with empty/whitespace input, or >200 characters | Nothing happens: no `api/client` call, no copy, no layout shift | Silent by design |
| Optimistic insert | Valid submit | Row at top of TODO before confirmation, controls disabled, temp key client-only | — |
| Confirmation swap | Server responds `201` | Optimistic row replaced by the server row, exactly one row, input cleared | — |
| Create failure | Stubbed rejection | Only that row disappears, others untouched, alert shows the server message, typed text still in the input | `ApiRequestError.message`, else the single local network string |

</intent-contract>

## Code Map

Backend (under `backend/`):
- `app/schemas.py:8` -- `DESCRIPTION_MAX_LENGTH = 200` already exists; `TodoCreate` at `:23-24` is a bare `description: str`. Add the normalizer here (an `AfterValidator`-style callable beside `_as_utc`) and attach it to `TodoCreate.description` so trim-then-validate is the schema's job (AD-10). `ApiSchema:19-20` already supplies the camelCase alias generator — do not add per-field aliases.
- `app/repository.py:10-14` -- `list_todos` is the model for the layer. Add `create_todo(session, description, owner)` that constructs `Todo(...)`, `session.add`, `flush`, `refresh`, and returns it. Never commit here: `db.get_session:22-31` commits on success and rolls back on failure.
- `app/services.py:21-22` -- `list_todos` delegates to the repository. Add `create_todo` the same way; the description rules already ran in the schema, so there is nothing to re-enforce.
- `app/routers/todos.py:12-20` -- `SessionDep`/`OwnerDep` and the `GET ""` route are the pattern. Add `POST ""` with `status_code=201`, `response_model=TodoRead`, body `TodoCreate`, owner from `current_scope`.
- `app/main.py:46-59` -- the `RequestValidationError` handler already returns `400 VALIDATION_ERROR`; a `ValueError` raised inside the normalizer arrives here. Verify, do not duplicate.
- `app/models.py:15-22` -- `Todo` already defaults `id` to `uuid4` and `created_at` to `datetime.now(UTC)`; `user_id` is the scope seam. Unchanged.
- `backend/tests/conftest.py:11-29` -- `engine` (temp-file SQLite) and async `client` fixtures; reuse verbatim.
- `backend/tests/test_todos_api.py:10-21` -- `seed()` and the assertion style for the list endpoint; extend this file with the create tests rather than adding a parallel one.

Frontend (under `frontend/`):
- `src/api/types.ts:1-8` -- `DESCRIPTION_MAX_LENGTH` and `Todo` already exist and mirror `TodoRead`; no contract change (the request body is `{description}` only).
- `src/api/client.ts:47-49` -- `listTodos` is the shape to copy. Add `createTodo(description)` issuing `request<Todo>('/todos', { method: 'POST', body: JSON.stringify({ description }) })` — `request` prefixes `/api` and sets the JSON header itself.
- `src/hooks/useTodos.ts:13-49` -- holds `todos`/`loading`/`error` and partitions. Add the pending-row type, `addTodo`, and the rollback path here; `active`/`completed` must keep server order with optimistic rows on top.
- `src/App.tsx:9-21` -- the inert add-bar markup to move into `AddBar.tsx`; the `role="alert"` line at `:23-27` and the loading/columns block at `:29-38` stay.
- `src/components/TodoRow.tsx:7-21` -- add a `pending` flag that disables the checkbox and the delete button; markup otherwise unchanged.
- `src/components/TodoColumn.tsx:10-23` -- pass the row type through; it must keep re-filtering and re-sorting nothing.
- `src/styles/app.css:29-75` -- `.add-bar`, `.add-bar:focus-within`, `.btn-icon` (32px via `--add-btn-size`), `.field-input` are already authored to the mockup; only a pending-row rule may be needed, from existing tokens.
- `src/App.test.tsx:9-22` and `src/hooks/useTodos.test.ts:8-21` -- the `vi.mock('./api/client', importOriginal)` pattern; extend it to stub `createTodo` too.
- `e2e/tests/view-board.spec.ts:6-43` -- the `docker compose exec` seed/clear helpers and the self-resetting `beforeAll`/`afterAll`. The new journey creates through the UI and must delete its own row via the API (`DELETE` does not exist yet — use the same `py(CLEAR)` helper).
- `qa/story-1.2.md` -- the report format to follow for `qa/story-1.3.md`.
- `Makefile:23-49` -- `lint`, `coverage`, `test-e2e`, `ci`. Unchanged; new tests must run under the existing targets.

## Tasks & Acceptance

**Execution:**
- `backend/app/schemas.py` -- add the trim-then-validate normalizer and apply it to `TodoCreate.description`, keeping `DESCRIPTION_MAX_LENGTH` the only 200 -- AD-10 puts the rule in the schema.
- `backend/app/repository.py` -- add `create_todo(session, description, owner)`: construct, `add`, `flush`, `refresh`, return; no commit -- AD-9, AD-12.
- `backend/app/services.py` -- add `create_todo` delegating to the repository -- AD-1.
- `backend/app/routers/todos.py` -- add `POST ""`, `status_code=201`, `response_model=TodoRead`, owner from `current_scope` -- AD-2, AD-15.
- `backend/tests/test_schemas.py` -- the epic's one unit row: trim-then-validate at 0, 1, 200 and 201 characters.
- `backend/tests/test_todos_api.py` -- the epic's four backend integration rows: create success (UUIDv4 `id`, server `createdAt`), the three validation rejections in the one envelope, malformed body returning 400 not 422, and the round-trip to the head of `GET /api/todos`.
- `frontend/src/api/client.ts` -- add `createTodo(description)` -- AD-5, the only request site.
- `frontend/src/hooks/useTodos.ts` -- add `addTodo`: reject silently when the trimmed text is empty or exceeds `DESCRIPTION_MAX_LENGTH`; otherwise insert a temp-keyed pending row at the top, call `createTodo`, swap in the server row on success, and on failure remove only that row and set `error` -- AD-6, FR-3, FR-4.
- `frontend/src/components/AddBar.tsx` -- create it holding nothing but its input text: accent `+` (`aria-label="Add todo"`) left of a bottom-bordered input with no placeholder, autofocused, submitting on Enter or click, clearing only on success -- UX-DR3, UX-DR7, AD-6.
- `frontend/src/components/TodoRow.tsx` -- disable the checkbox and delete control while the row is pending -- AD-7.
- `frontend/src/components/TodoColumn.tsx` -- carry the pending row type through unchanged in behaviour -- AD-6.
- `frontend/src/App.tsx` -- render `AddBar` wired to `addTodo`; leave the alert, loading and column blocks intact -- FR-3.
- `frontend/src/styles/app.css` -- add a pending-row rule only if needed, from existing `var(--token)` values -- UX-DR1.
- `frontend/src/App.test.tsx` -- the epic's five frontend integration rows: both submit paths, optimistic insert at top with controls disabled, confirmation swap with no duplicate, client-side rejection issuing no client call, and create rollback preserving the input text and surfacing the error.
- `e2e/tests/create-todo.spec.ts` -- the epic's single journey: type a description, press Enter, the row appears at the top of TODO, reload and it persisted; self-resetting and order-independent.
- `qa/story-1.3.md` -- the agentic QA report with a verdict and evidence for each of the five checks (performance, coverage, accessibility, security, functional-in-Chrome).

**Acceptance Criteria:**
- Given the backend source, when searched for `select(`, `order_by`, `session.add(` and `.commit()`, then every query and mutation is inside `repository.py` and no commit happens outside `db.get_session`.
- Given the backend source, when searched for the literal `200` in validation code, then only `DESCRIPTION_MAX_LENGTH` in `schemas.py` defines it; likewise `api/types.ts` on the client.
- Given `AddBar.tsx`, when read, then it imports neither the API client nor `useTodos` and holds only its input text; given `useTodos.ts`, then it is the only module calling `api/client.ts`.
- Given a create failure, when the rollback runs, then the code removes exactly the affected temp-keyed row and no whole-list snapshot is taken anywhere in the hook.
- Given the add bar at 320px and at 1280px, when a row is added, then nothing clips, shifts or overflows and the accent focus-visible ring is present on `+`.
- Given `make ci`, when it runs, then lint, both suites with their ≥70% line gates, and both Playwright journeys pass.
- Given the story is complete, when the work is published, then a branch cut from `story-1.2-view-the-todo-board` carries the change, a pull request targets that branch naming the story, FR-3/FR-4/FR-7 and the ADs to spot-check (AD-1, AD-2, AD-4, AD-6, AD-7, AD-9, AD-10, AD-15), and `qa/story-1.3.md` records the five agentic checks.

## Spec Change Log

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 3, low 4)
- defer: 4: (high 0, medium 3, low 1)
- reject: 22: (high 0, medium 0, low 22)
- addressed_findings:
  - `[medium]` `[patch]` The load effect's `setTodos(loaded)` overwrote optimistic rows. The input is
    autofocused on load, so a user can submit before `listTodos` settles; their row then vanished
    from the board although the POST had succeeded. The effect now merges, keeping pending rows on
    top of the arriving list. Verified in real Chrome with the list request delayed 15 seconds.
  - `[medium]` `[patch]` The client's accept boundary was unpinned: an off-by-one guard, or a lower
    `DESCRIPTION_MAX_LENGTH` in `api/types.ts`, silently refused a 200-character description the API
    accepts while every suite stayed green. The epic's existing "both submit paths" case was
    strengthened to submit a maximum-length description and assert it reached `createTodo`;
    mutation-verified against a `>=` guard.
  - `[medium]` `[patch]` `setError(null)` on the success path was asserted by nothing, so deleting it
    left a stale red alert on the board forever after one failure, with all tests green. The epic's
    existing rollback case now continues into a succeeding retry and asserts the alert is gone;
    mutation-verified.
  - `[low]` `[patch]` The client counted UTF-16 code units while the server counts code points, so a
    150-emoji description was silently refused client-side though the API accepts it. The guard now
    measures `[...trimmed].length`.
  - `[low]` `[patch]` `test_boundary_lengths_are_accepted` had no row in the epic's Story 1.3 table
    and duplicated the unit row's boundary cases over HTTP. Removed, per the invocation's
    restriction to the table's tests.
  - `[low]` `[patch]` The create tests hard-coded `"x" * 201` while `test_schemas.py` used the
    constant, so the bound could drift out from under them. They now import
    `DESCRIPTION_MAX_LENGTH`.
  - `[low]` `[patch]` `sprint-status.yaml` still carried `1-3-add-a-todo: backlog`. Set to `review`,
    matching how 1-1 and 1-2 are recorded, with `last_updated` refreshed.

Rejected as noise or out of scope on the intent's authority: a `maxLength` attribute and inline
validation copy (the epic mandates silent rejection plus a 250-character paste ad-hoc check), a
double-submit guard, control-character and Unicode-normalization validation, an `IntegrityError`
branch (the generic handler in `main.py` already answers the AD-4 envelope), temp-id collisions (the
counter is monotonic), an unmount guard, the `BoardTodo` type living in the hook module (components
depending on hooks is downward under AD-1), OpenAPI 400 documentation, a shared E2E reset fixture,
and various test-hygiene preferences.

## Design Notes

**Where the 400 comes from.** The normalizer raises `ValueError` inside `TodoCreate`, so FastAPI wraps it in `RequestValidationError` and the handler already registered in `main.py:46` answers `400 {"error": "VALIDATION_ERROR", ...}`. That keeps one error path for malformed bodies and rejected descriptions alike — do not raise `app.errors.ValidationError` from the route or the service for this case.

```python
def _normalize_description(value: str) -> str:
    trimmed = value.strip()
    if not 1 <= len(trimmed) <= DESCRIPTION_MAX_LENGTH:
        raise ValueError("Description must be 1-200 characters.")
    return trimmed
```

**Optimistic rows.** Keep one `todos` array of `Todo & { pending?: true }`, with pending rows prepended. The temp key is the row's React key only; the request body is `{description}`, so no temp value can reach the API. On success replace by temp key (`map`, not `filter`+`push`) so the row does not jump; on failure `setTodos((current) => current.filter((row) => row.id !== tempId))` — never restore a saved snapshot, which would undo a concurrent add.

**E2E self-reset.** `create-todo.spec.ts` creates through the UI, so `afterAll` must clear the rows with the same `py(CLEAR)` helper `view-board.spec.ts` uses; the `test` profile keeps the database in a tmpfs and `make test-e2e` tears it down with `--volumes`, so the two journeys stay order-independent.

## Verification

**Commands:**
- `make lint` -- expected: Ruff check and format plus the frontend typecheck exit zero.
- `make test-backend` -- expected: the new unit and create tests pass alongside 1.1 and 1.2; `coverage report` stays ≥70%.
- `make test-frontend` -- expected: the five new frontend cases pass; line coverage ≥70%.
- `make test-e2e` -- expected: `view-board.spec.ts` and `create-todo.spec.ts` both pass and the profile is torn down.
- `make ci` -- expected: the full chain is green.
- `grep -rn 'session.add(\|\.commit()\|select(\|order_by' backend/app` -- expected: mutations and queries only in `repository.py`; the only `commit()` is in `db.py`.
- `grep -rn '200' backend/app frontend/src --include='*.py' --include='*.ts' --include='*.tsx' | grep -v test` -- expected: the bound is defined once per side.
- `grep -rn 'fetch(' frontend/src --include='*.ts' --include='*.tsx' | grep -v test` -- expected: only `api/client.ts`.
- `curl -s -X POST localhost:8000/api/todos -H 'Content-Type: application/json' -d '{"description":"  spec check  "}'` -- expected: `201` with a trimmed description, UUIDv4 `id`, camelCase `createdAt`, no `userId`.
- `curl -s -X POST localhost:8000/api/todos -H 'Content-Type: application/json' -d '{"description":"   "}'` -- expected: `400 {"error":"VALIDATION_ERROR","message":"..."}` with no stack trace, SQL or request echo.

## Auto Run Result

Status: done
Blocking condition: none

**Implemented change**

The create half of the todo CRUD API and the add bar that drives it. `POST /api/todos` trims and
bounds the description in `schemas.py`, so rejections and malformed bodies alike surface through the
`RequestValidationError` handler already registered in `main.py` as one `400 VALIDATION_ERROR`
envelope — no second error path. The row is constructed in `repository.py` with the owner taken from
`current_scope`, flushed and refreshed but never committed there, leaving the request-scoped session
in charge. On the client, `createTodo` joins `api/client.ts` as the second and only other request
site, `useTodos` gained `addTodo` — silent client-side rejection, a temp-keyed pending row prepended
before the call, a swap by temp key on success, and removal of exactly that row on failure — and a
new `AddBar` holds nothing but its input text, clearing only once the server confirms.

**Files changed**

- `backend/app/schemas.py` — `_normalize_description` trims then bounds, attached to
  `TodoCreate.description`.
- `backend/app/repository.py` — `create_todo`: construct, add, flush, refresh; no commit.
- `backend/app/services.py` — `create_todo` delegates to the repository.
- `backend/app/routers/todos.py` — `POST ""`, 201, `TodoRead`, owner from `current_scope`.
- `backend/tests/test_schemas.py` — the epic's unit row: trim-then-validate at 0, 1, 200, 201.
- `backend/tests/test_todos_api.py` — the epic's four backend integration rows.
- `frontend/src/api/client.ts` — `createTodo(description)`.
- `frontend/src/hooks/useTodos.ts` — `addTodo`, the `BoardTodo` type, optimistic insert and per-row
  rollback; the load effect merges rather than replaces.
- `frontend/src/components/AddBar.tsx` — new; holds only its input text.
- `frontend/src/components/TodoRow.tsx`, `TodoColumn.tsx` — carry `pending` through and disable an
  unconfirmed row's controls.
- `frontend/src/App.tsx` — renders `AddBar`; alert, loading and columns untouched.
- `frontend/src/styles/app.css` — disabled-control rules from existing tokens.
- `frontend/src/App.test.tsx` — the epic's five frontend integration rows.
- `e2e/tests/create-todo.spec.ts` — new; the single journey, self-resetting.
- `e2e/playwright.config.ts` — serialized so the two journeys cannot interleave their resets.
- `qa/story-1.3.md` — the five agentic checks with verdicts and evidence.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story 1.3 moved to `review`.

**Review findings breakdown**

- Patches applied: 7 (high 0, medium 3, low 4).
- Items deferred: 4 — the ~60s nginx timeout on a create against a dead backend, the unpinned
  owner-stamping on POST, the untested load/create merge, and the repo-wide Playwright
  serialization.
- Items rejected: 22.
- Follow-up review recommended: `true` — patched severities were high 0, medium 3, low 4, giving
  3 x 3 + 1 x 4 = 13, at or above the threshold of 5.

**Verification performed**

- `make lint` — exit 0 (Ruff check and format, `tsc --noEmit`).
- `make test-backend` — 30 passed, coverage 99% (182 statements, 2 missed).
- `make test-frontend` — 17 passed across 3 files.
- `make test-e2e` — both journeys pass; the test profile is torn down with its volumes.
- Greps: every `select(`/`order_by`/`session.add(` is in `repository.py`, the only `commit()` is in
  `db.py:26`, `fetch(` appears only in `api/client.ts`, `api/client` is imported only by
  `useTodos.ts`, the 200 bound is defined once per side, and no hex literal appears outside
  `tokens.css`.
- Curls against a live backend: trimming, 1- and 200-character acceptance, and empty, whitespace,
  201-character, `{}` and non-JSON rejection all answer as the matrix requires, with no stack trace,
  SQL or request echo in any body and no `userId` in any response.
- Matrix audit: all nine I/O rows are covered by tests that ran and passed in the above.

**Residual risks**

- The four deferred items above, of which the owner-stamping gap and the untested merge are the two
  that a future change could silently break.
- The E2E journeys reset through `docker compose exec`, not the API, because `DELETE` does not exist
  until story 1.4. The epic's table describes the API route; it becomes available next story.
