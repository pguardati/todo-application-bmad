# Agentic QA — Story 1.4: Complete and Delete a Todo

**Story:** 1.4 — Complete and Delete a Todo
**Date:** 2026-08-29
**Verdict:** PASS (5 / 5 checks, one non-blocking contrast finding carried over from Story 1.2)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS (one carried-over token contrast finding) |
| Security | PASS |
| Functional (real Chrome) | PASS |

Measurements were taken against the `test` compose profile (nginx `:8080` → backend `:8000` →
tmpfs SQLite), driven through a real Chromium page unless stated otherwise.

---

## 1. Performance — mutate latency (NFR-1)

**Verdict: PASS**

60 rows created, then each toggled and each deleted through the full edge path:

| Endpoint | p50 | p95 | max | n |
| --- | --- | --- | --- | --- |
| `PATCH /api/todos/{id}` | 3.2 ms | 4.8 ms | 6.0 ms | 60 |
| `DELETE /api/todos/{id}` | 2.3 ms | 3.5 ms | 4.8 ms | 60 |

p95 of 4.8 ms is ~100× inside the ≤500 ms localhost budget, and in line with the create slice's
5.7 ms — the mutate endpoints did not regress the path.

The user-visible change does not wait on the round trip at all: with the `PATCH` held open by a
route stub, the row was rendered in DONE **58 ms** after the click, and the `DELETE` row vanished
before its response was released.

## 2. Coverage — both gates, with the story's files named (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (212 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 93.91% lines | 70% | Vitest `coverage.thresholds.lines: 70` |

Per-file for the files this story touched:

| File | Lines |
| --- | --- |
| `backend/app/schemas.py` | 100% (29/29) |
| `backend/app/repository.py` | 100% (24/24) |
| `backend/app/services.py` | 100% (27/27) |
| `backend/app/routers/todos.py` | 100% (23/23) |
| `frontend/src/components/TodoRow.tsx` | 100% lines (75% branch — the neighbour/fallback arms of `moveFocusOut`) |
| `frontend/src/components/TodoColumn.tsx` | 100% |
| `frontend/src/hooks/useTodos.ts` | 95.83% — the uncovered lines are the three "nothing to do" early returns (unknown id, pending row) |
| `frontend/src/api/client.ts` | 81.81% — the uncovered lines are the `listTodos`/`createTodo`/`updateTodo`/`deleteTodo` one-liners, stubbed in unit tests and covered end to end by the Playwright journeys |

Test counts: backend 38 passed (was 30), frontend 23 passed (was 17), E2E 3 journeys passed. Eight
backend test functions were added: the epic's five Story 1.4 rows, plus two closing the spec's
"Bad update body" I/O-matrix row (`PATCH {}` / `{"completed":"yes-ish"}` parametrized, and a non-JSON
body) and one extension of the existing owner-exclusion case that now also asserts `PATCH` and
`DELETE` against another owner's row. Frontend: the epic's six cases, no new test functions — review
patches extended the existing rollback and optimistic-delete cases instead. One E2E journey, no unit
tests (the table's unit row is `none`).

**Mutation proof that the new assertions are load-bearing** — each mutation applied in isolation,
suite run, source restored:

| Mutation | Result |
| --- | --- |
| `NotFoundError` → `ValidationError` in `set_completed` | backend: **2 failed**, 33 passed |
| `status_code=204` → `200` on the delete route | backend: **1 failed**, 34 passed |
| Drop the revert on a failed toggle | frontend: **2 failed**, 21 passed |
| Failed delete appends instead of splicing at the original index | frontend: **1 failed**, 22 passed |
| Failed toggle restores a whole-list snapshot | frontend: **1 failed**, 22 passed |
| `PATCH` sends the stale `completed` value | frontend: **1 failed**, 22 passed |
| `TodoRow` checkbox back to `readOnly` | frontend: **4 failed**, 19 passed |
| `TodoRow` `×` handler removed | frontend: **3 failed**, 20 passed |
| Drop the owner filter from `repository.get_todo` | backend: **1 failed**, 37 passed |
| `update_completed` mutates only the returned object, never the session | backend: **1 failed**, 37 passed |
| Drop `setError(null)` after a successful toggle | frontend: **1 failed**, 22 passed |
| Drop `setError(null)` after a successful delete | frontend: **1 failed**, 22 passed |
| Remove the `moveFocusOut` call from `TodoRow` | frontend: **1 failed**, 22 passed |
| Route passes `None` instead of `current_scope` to `set_completed` | backend: 38 passed — **not covered**, see below |
| Drop the `pending` guard from `toggleTodo` | frontend: 23 passed — **not covered**, see below |

**Two behaviours remain un-asserted.** Each is verified live instead:

- **The route's own `current_scope` wiring.** `repository.get_todo`'s owner predicate is now covered
  (the owner-exclusion case asserts `PATCH` and `DELETE` against another owner's row both answer
  `404` and leave the row intact), but in v1 `current_scope` always returns `None`, so substituting
  `None` for the dependency at the route is indistinguishable from the real thing at the test layer.
  Verified by hand against the running stack (section 4).
- **The `pending` guard in `toggleTodo`.** Defence in depth behind `TodoRow`'s `disabled={todo.pending}`,
  which *is* asserted (Story 1.3's pending-row case) and verified live.

A sixth patch also added `session.flush()` to `repository.delete_todo`, so an integrity failure on a
delete raises inside the service's session rather than at commit time, where it would bypass the AD-4
envelope and land in the catch-all as a bare `500`. No test in the epic's table can reach that path —
v1 has no foreign keys onto `todo` — so it is a correctness alignment with `create_todo` and
`update_completed`, not a covered behaviour.

## 3. Accessibility — toggling and deleting (UX-DR5, NFR-5)

**Verdict: PASS** (one carried-over token finding, not a gate — the epic makes WCAG 2.1 AA a stretch
goal, not a bar)

**axe-core 4.13.0** (`@axe-core/playwright` 4.13.0, Chromium against `http://localhost:8080`, rule set
`wcag2a, wcag2aa, wcag21a, wcag21aa`) on a board carrying completed rows:

```json
{ "axeVersion": "4.13.0", "passes": 18, "incomplete": ["color-contrast"],
  "violations": [{ "id": "color-contrast", "nodes": 2 }] }
```

Both nodes are the same, already-recorded issue: a completed row's `.label` renders
`--color-text-done` `#555555` on `--color-canvas` `#000000` = **2.81:1**, under the 4.5:1 AA bar.
This is the exact finding `qa/story-1.2.md` recorded against the token, not a defect in this story's
change surface — no rule this story introduced fails, and no new hex was added. It is more reachable
now (a user can create a completed row from the UI for the first time), so the token recommendation
to the UX owner stands and is restated here.

Read from the live page:

| Requirement | Observed |
| --- | --- |
| Controls without an accessible name | **0** |
| Positive `tabindex` | **0** — DOM order is tab order |
| Checkbox state exposed | after a toggle the row's checkbox reports `checked: true` and renames to `Mark incomplete` |
| Completion without colour alone | strikethrough (`text-decoration-line: line-through`), the DONE column, and the checkbox state — three independent signals |
| Keyboard toggle | focusing the checkbox and pressing `Space` moved the row between columns |
| Checkbox focus ring | `outline-color: rgb(76, 175, 106)` = `--color-accent` |
| `×` colour | `rgb(68, 68, 68)` = `--color-control`; hover `rgb(136, 136, 136)` = `--color-control-hover` — neutral gray, lighter on hover, never accent, never red |
| Focus when a row leaves the DOM | focus moves to the neighbouring row's `Delete` (falling back to the previous row, then the add input) — **not** lost to `<body>`, not trapped |
| New copy | none — no validation text, no undo affordance, no new heading level |

`TodoRow` hands focus to a neighbour *before* calling `onDelete`, because the optimistic removal
unmounts the row synchronously. Without it Chrome reset focus to `<body>`, which the acceptance
criteria forbid; that was found by this QA pass and fixed.

## 4. Security — mass assignment, scoping and layering (AD-16)

**Verdict: PASS**

| Assertion | Evidence |
| --- | --- |
| `completed` is the only writable field | `PATCH {"completed":true,"description":"hacked","id":"forged","createdAt":"1999-01-01T00:00:00Z","userId":"other"}` → `200` with the original id, original description, original `createdAt`, only `completed` changed; a follow-up `GET` confirms the stored row |
| Immutability is by construction | `TodoUpdate` declares only `completed`; the route passes `payload.completed` and nothing else, so no extra key can reach the model |
| Malformed body never 422 | `{}`, `{"completed":"yes-ish"}` and a non-JSON body all → `400 {"error":"VALIDATION_ERROR","message":"Invalid request."}` |
| Unknown id, both verbs | `PATCH`/`DELETE /api/todos/does-not-exist` → `404 {"error":"NOT_FOUND","message":"Todo not found."}` |
| Delete is idempotent-safe, not silent | first `DELETE` → `204` with a zero-byte body; the repeat → `404` in the same envelope |
| No leakage | every error body is exactly `{error, message}` — no path, no SQL, no stack trace, no echo of the input |
| Cross-owner write is a 404, not a write | a row seeded with `user_id='other'`: `PATCH` → `404`, `DELETE` → `404`, and the row survives |
| Owner column never leaves the server | `PATCH` response keys are exactly `{id, description, completed, createdAt}` |
| `NOT_FOUND` is constructed once | `grep -rn 'NOT_FOUND' backend/app` → only `errors.py:11`; no route or service builds an envelope inline |
| SQL is expressions only, in one module | `grep -rn 'select(\|session.add(\|session.delete(\|\.commit()' backend/app` → `repository.py:7,13,19,26,32,39` plus the single `commit()` in `db.py:26` |
| Single request site, relative only | `grep -rn 'fetch(' frontend/src` (non-test) → only `api/client.ts:18` |
| No whole-list snapshot | the only `useState` list lives in `useTodos`; each revert targets one id (`row.id === id`) or one index — no snapshot variable exists |
| `TodoRow` is presentational | it imports only the `BoardTodo` type — no API client, no hook function; it invokes props |
| No new hex | `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.ts*'` → no matches |

## 5. Functional in real Chrome (Chromium via Playwright/CDP)

**Verdict: PASS**

`test` profile, nginx at `http://localhost:8080`, board seeded `Fix the auth bug` / `Buy groceries`
(TODO) and `Morning standup` (DONE):

| Check | Observed |
| --- | --- |
| Console messages | **none**; no page errors |
| Network | only `GET /api/todos 200`, `PATCH /api/todos/{id} 200`, `DELETE /api/todos/{id} 204` — every request same-origin, path exactly `/api/todos/…` |
| Toggle to DONE | `Fix the auth bug` left TODO and headed DONE, strikethrough applied, checkbox `checked` |
| Toggle back | it returned to TODO in its original place, DONE back to one row |
| Delete | the row disappeared and `GET /api/todos` no longer returns it |
| Survives a reload | after deleting, the reloaded board shows the deletion held |
| Optimistic toggle | with the `PATCH` held open, the row was in DONE 58 ms after the click, long before the response |
| Optimistic delete | with the `DELETE` held open, the row was already gone from the list |
| Toggle rollback | the held `PATCH` released as `404`: only that row returned to TODO, and `role="alert"` read the server's `Todo not found.` verbatim |
| Delete rollback | the held `DELETE` released as `404`: the row reappeared in place and the alert showed |
| **Anti-snapshot, live** | while the failing `PATCH` on `q3` was in flight, `q1` was toggled to DONE successfully. The rollback returned **only** `q3` to TODO — `q1` stayed in DONE, matching the server (`q1.completed: true`). A whole-list restore would have undone it |
| Alert clears on the next success | the alert line disappears after the next successful toggle |
| Focus after delete | `document.activeElement` is the neighbouring row's `Delete` button, never `<body>` |
| 320px | `.columns` one `272px` track, widest row right edge 296px inside 320px, `scrollWidth === innerWidth` — nothing clips after a toggle |
| 1280px | `.columns` `520px 520px`, no horizontal overflow, `.columns` top identical before and after a toggle — no layout shift |

The only vertical shift observed at 320px was the error line clearing itself on the next success
(199px → 136px), which is the intended behaviour of the alert, not a toggle-induced reflow.

---

## Ad-hoc checks

| Check | Result |
| --- | --- |
| `204` carries no body | `curl -si -X DELETE` → `HTTP/1.1 204 No Content`, zero bytes; `request<void>` returns `undefined` through its existing 204 branch |
| No commit outside `db.get_session` | `update_completed` does `assign` → `add` → `flush` → `refresh`; `delete_todo` does `session.delete` only |
| Route never inspects the result | both handlers return the service call directly; the 404 originates only in `services.set_completed` / `services.delete_todo` |
| Components do not re-partition | `TodoColumn` threads `onToggle`/`onDelete` through and still filters and sorts nothing |
| E2E order independence | `complete-and-delete.spec.ts` clears in `beforeAll` **and** `afterAll` with the same `docker compose exec backend python` helper, and seeds through `request.post('/api/todos')` rather than the UI |
| `make lint` | Exit 0 — Ruff check, Ruff format check, `tsc --noEmit` |
| `make test-backend` | 38 passed; coverage 99% |
| `make test-frontend` | 23 passed (3 files) |
| `make test-e2e` | all 3 journeys passed; profile torn down with `--volumes` |
| `make ci` | **Exit 0** |
