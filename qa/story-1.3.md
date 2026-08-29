# Agentic QA — Story 1.3: Add a Todo

**Story:** 1.3 — Add a Todo
**Date:** 2026-08-29
**Verdict:** PASS (5 / 5 checks, one non-blocking latency finding recorded)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS |
| Security | PASS |
| Functional (real Chrome) | PASS (with a recorded edge-timeout finding) |

Measurements were taken against the `test` compose profile (nginx `:8080` → backend `:8000` →
tmpfs SQLite), driven through the real Chrome page unless stated otherwise.

---

## 1. Performance — create latency (NFR-1)

**Verdict: PASS**

`POST /api/todos` through the full edge path, 60 sequential samples:

| Metric | Measurement |
| --- | --- |
| p50 | 2.8 ms |
| p95 | 5.7 ms |
| max | 8.1 ms |

`GET /api/todos` over the same 60-row table, 60 samples: p50 3.4 ms, p95 4.6 ms, max 6.7 ms — the
create slice did not regress the read path.

First render on the nginx build, read from the live page: `domContentLoaded` 79 ms, `load` 79 ms,
first-paint 72 ms, first-contentful-paint 120 ms. The optimistic row is painted from local state,
so the user-visible insert does not wait on the round trip at all.

p95 of 5.7 ms is ~90× inside the ≤500 ms localhost budget.

## 2. Coverage — both gates, with the story's files named (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (182 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 97.1% lines | 70% | Vitest `coverage.thresholds.lines: 70` |

Per-file for the files this story touched:

| File | Lines |
| --- | --- |
| `backend/app/schemas.py` | 100% (27/27) |
| `backend/app/repository.py` | 100% (13/13) |
| `backend/app/services.py` | 100% (17/17) |
| `backend/app/routers/todos.py` | 100% (17/17) |
| `frontend/src/hooks/useTodos.ts` | 100% lines (97.67% statements) |
| `frontend/src/components/AddBar.tsx` | 100% |
| `frontend/src/components/TodoRow.tsx` | 100% |
| `frontend/src/components/TodoColumn.tsx` | 100% |
| `frontend/src/api/client.ts` | 90% — the two uncovered lines are the `listTodos`/`createTodo` one-liners, which are stubbed in unit tests and covered end to end by the Playwright journeys |

Test counts: backend 30 passed (was 15), frontend 17 passed (was 11), E2E 2 journeys passed. No case
was added beyond the epic's Story 1.3 table; review triage removed one backend case that had no row in
it and strengthened two existing frontend cases instead of adding new ones.

**Mutation proof that the new assertions are load-bearing** — each mutation applied, suite run,
source restored:

| Mutation | Result |
| --- | --- |
| Drop `.strip()` from `_normalize_description` | backend: **6 failed**, 26 passed |
| `status_code=201` → `200` on the create route | backend: **3 failed**, 29 passed |
| Drop `disabled={todo.pending}` from `TodoRow` | frontend: **1 failed**, 16 passed |
| Remove the client-side length guard in `addTodo` | frontend: **1 failed**, 16 passed |
| Remove the rollback `filter` on create failure | frontend: **1 failed**, 16 passed |
| Append the optimistic row instead of prepending it | frontend: **3 failed**, 14 passed |
| Prepend the server row instead of swapping by temp key | frontend: **1 failed**, 16 passed |
| Clear the input regardless of the result in `AddBar` | frontend: **2 failed**, 15 passed |
| Widen the client guard to `length >= DESCRIPTION_MAX_LENGTH` | frontend: **1 failed**, 16 passed |
| Delete `setError(null)` from the create success path | frontend: **1 failed**, 16 passed |
| Replace the load-effect merge with `setTodos(loaded)` | frontend: 17 passed — **not covered**, see below |

**One fixed behaviour is not test-asserted.** The load effect merges rather than replaces
(`[...current.filter((row) => row.pending), ...loaded]`) so a row submitted before `listTodos`
settles is not wiped by the arriving list. Reverting that merge keeps every suite green, because
covering it would need a sixth frontend case and the epic's Story 1.3 table allows five. It is
verified in the real browser instead — see the race row in section 5.

## 3. Accessibility — add bar and populated board (UX-DR8, NFR-5)

**Verdict: PASS**

**axe-core 4.13.0** (`@axe-core/playwright` 4.13.0, run from the pinned local package against
`http://localhost:8080` in Chromium, rule set `wcag2a, wcag2aa, wcag21a, wcag21aa`), after adding a
row through the UI:

```json
{ "axeVersion": "4.13.0", "passes": 18, "incomplete": ["color-contrast"], "violations": [] }
```

Zero violations. (Story 1.2's recorded `--color-text-done` contrast finding is a completed-row
token issue and does not arise on this story's surface, which creates only active rows. The token
recommendation from `qa/story-1.2.md` still stands for the UX owner.)

Read from the live page:

| Requirement | Observed |
| --- | --- |
| Add-bar element | `<form class="add-bar">` — Enter submits natively, no key handler |
| Controls without an accessible name | **0** |
| Positive `tabindex` | **0** — DOM order is tab order |
| Focus on load | the `New todo` textbox (`autoFocus` preserved) |
| Tab order | `Add todo` → `New todo` → per row `Mark complete` → `Delete` |
| `+` focus ring | keyboard focus (`Shift+Tab`) → `:focus-visible` matches, computed `solid 2px rgb(76, 175, 106)` with `2px` offset = `--color-accent` |
| Add-bar focus-within | border-bottom becomes `rgb(76, 175, 106)` = `--color-accent` |
| Pending row | checkbox and `×` report `disabled` while unconfirmed, so they are removed from tab order and cannot be actuated |
| Placeholder / validation copy | none — nothing was added |

## 4. Security — input handling and layering (AD-16)

**Verdict: PASS**

| Assertion | Evidence |
| --- | --- |
| Server-authoritative trim | `POST {"description":"  spec check  "}` → `201` with `"description":"spec check"` |
| Bound enforced server-side | 1-char → `201`, 200-char → `201`, 201-char → `400` |
| Blank / whitespace rejected | `""` and `"   "` → `400 {"error":"VALIDATION_ERROR","message":"Invalid request."}` |
| Malformed body never 422 | `{}`, `{"description":42}` and a non-JSON body all → `400` with the same envelope |
| No leakage in the error body | body is exactly `{error, message}` — no stack trace, no SQL, no echo of the input |
| Client-supplied fields ignored | `{"id":"hack","description":"forged","completed":true,"createdAt":"1999-01-01T00:00:00Z","userId":"other","pending":true}` → `201` with a fresh UUIDv4 id, `completed:false`, server `createdAt`; the row is returned by the implicit-owner `GET`, proving `userId` never reached the model |
| Owner column never leaves the server | create response keys are exactly `{id, description, completed, createdAt}` |
| XSS through a description | `<script>alert(1)</script> & "quoted" <b>bold</b>` added through the UI renders as literal text: `.label` `textContent` byte-identical, **0** child elements, `document.querySelector('.label script, .label b')` → `null`, no dialog, no console message |
| No `innerHTML` / `dangerouslySetInnerHTML` | `grep -rn 'innerHTML' frontend/src` → no matches |
| SQL is expressions only | `grep -rn 'session.add(\|\.commit()\|select(\|order_by' backend/app` → `repository.py:7,13,19` plus the single `commit()` in `db.py:26` |
| Bound defined once per side | `DESCRIPTION_MAX_LENGTH` in `schemas.py:8` and `api/types.ts:1`; the only other `200` is the health status code |
| Single request site, relative only | `grep -rn 'fetch(' frontend/src` (non-test) → only `api/client.ts:18`; `api/client.ts` is imported by `hooks/useTodos.ts` and nothing else |
| No hard-coded hex outside `tokens.css` | `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.ts*'` → no matches |

## 5. Functional in real Chrome (Chrome DevTools MCP)

**Verdict: PASS**

`test` profile, nginx at `http://localhost:8080`:

| Check | Observed |
| --- | --- |
| Console messages | **none** |
| Network requests | `/`, hashed JS, hashed CSS, `GET /api/todos` `200`, then one `POST /api/todos` `201` per add — every URL on the page origin, path exactly `/api/todos` |
| Enter submits | typing `  Water the plants  ` + Enter creates the row |
| `+` click submits | asserted in `App.test.tsx`; the button is the form's submit control, so both paths run the same handler |
| Trim on the wire | the created row reads `Water the plants` |
| Position | the new row is first in TODO, above the three pre-existing rows; DONE untouched |
| No duplicate after confirmation | exactly one `Water the plants` label in the DOM |
| Input cleared on success | `#new-todo` value `""`, focus retained on the input |
| Pending row | before confirmation the row's checkbox and `×` are `disabled:true` while every other row stays enabled |
| Client-side rejection — whitespace | `"     "` + Enter: resource entries for `/api/todos` unchanged (3 → 3), no new row, no `role="alert"`, text left in the input |
| Client-side rejection — 201 chars | same: no request, no copy, input still holds all 201 characters |
| Create failure (backend container stopped) | only the pending row disappeared, the other 5 rows and DONE untouched, `role="alert"` reads `Could not reach the server. Please try again.` (nginx answers HTML, not the AD-4 envelope, so the client's single local network string is used), and `Will fail` was still in the input |
| Accept boundary on the wire | a 200-character description issues a `POST`; a 201-character one issues none and stays in the input |
| 150-emoji description | one `POST`, row rendered — the client no longer refuses what the server accepts |
| Submit racing the initial load | with `GET /api/todos` delayed 15 s and the row submitted while `role="status"` was still on screen, the created row was still on the board after the list arrived, and `GET /api/todos` confirmed exactly one persisted row per submit — the merge keeps optimistic rows, with no duplicate |
| Alert clears on the next success | after a failed create, a subsequent successful create removes the `role="alert"` line (asserted in `App.test.tsx` and mutation-verified) |
| 320px | `.columns` one `272px` track, add bar `x=24 w=272 h=48`, `+` exactly `32×32` (`--add-btn-size`), widest row right edge 296px inside 320px, `scrollWidth === innerWidth` — nothing clips or overflows after an add |
| 1280px | `.columns` `520px 520px`, no horizontal overflow, `.columns` top stays at `144px` before and after an add — no layout shift |

**Finding (non-blocking): a create against an unreachable backend takes ~60 s to surface.**
With the backend container stopped, nginx holds the proxied `POST` for its 60 s default
`proxy_read_timeout` before answering; the optimistic row therefore sits disabled for a minute
before the rollback and the alert appear. The behaviour itself is correct (only that row reverts,
the message is recoverable, the text is preserved) and this is an infrastructure timeout, not a
defect in the story's change surface — no ordinary failure (validation, 4xx, 5xx from a running
backend) is affected. Recorded for Story 1.6, which owns retry and the failure affordance; a
client-side `AbortController` deadline or an nginx `proxy_read_timeout` is the fix.

---

## Ad-hoc checks

| Check | Result |
| --- | --- |
| Boundary lengths end to end | 1-char and 200-char descriptions both `201`; 201 chars `400` (asserted at the unit layer, where the epic's table puts the boundary row) |
| Client and server count the same units | 150 emoji = 150 code points but 300 UTF-16 units; the API returns `201` and the client submits it, because `addTodo` measures `[...trimmed].length` |
| Round trip | a created row is the first element of `GET /api/todos` and byte-identical to the create response |
| No commit outside `db.get_session` | `repository.create_todo` does `add` → `flush` → `refresh` only; the request-scoped session commits |
| `AddBar` purity | it imports neither `api/client` nor `useTodos`; its only state is the input text (`grep` over `src/components/*.tsx` finds `useState` in `AddBar` alone, and no client import anywhere in `components/`) |
| Rollback shape | `setTodos((current) => current.filter((row) => row.id !== tempId))` — no snapshot variable exists anywhere in the hook |
| Temp key never sent | the request body is built as `JSON.stringify({ description })` in `api/client.ts`; the browser network entry for the create carries only `description` |
| E2E order independence | `create-todo.spec.ts` clears in `beforeAll` **and** `afterAll` with the same `docker compose exec backend python` helper `view-board.spec.ts` uses. `playwright.config.ts` now pins `workers: 1` / `fullyParallel: false` because the two journeys share one database and would otherwise interleave their seed and clear steps |
| `make lint` | Exit 0 — Ruff check, Ruff format check, `tsc --noEmit` |
| `make test-backend` | 32 passed; coverage 99% |
| `make test-frontend` | 17 passed (3 files) |
| `make test-e2e` | both journeys passed; profile torn down with `--volumes` |
| `make ci` | **Exit 0** |
