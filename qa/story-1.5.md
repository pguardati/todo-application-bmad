# Agentic QA — Story 1.5: Intentional Empty State

**Story:** 1.5 — Intentional Empty State
**Date:** 2026-08-29
**Verdict:** PASS (5 / 5 checks, zero production-code changes)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS |
| Security | PASS |
| Functional (real Chrome) | PASS |

Measurements were taken against the `test` compose profile (nginx `:8080` → backend `:8000` →
tmpfs SQLite), driven through a real Chromium page (Playwright 1.62.1) unless stated otherwise.
The database was cleared through the backend container before each measurement, so every number
below is against a genuinely empty table.

---

## 1. Performance — empty cold open and no layout shift when the first row lands (NFR-1, NFR-8)

**Verdict: PASS**

Cold open of the empty board through the edge:

| Metric | Value |
| --- | --- |
| `domContentLoaded` | 43.5 ms |
| `loadEventEnd` | 44.1 ms |
| First contentful paint | 72 ms |
| Board interactive (both headings rendered, from `goto`) | 605–615 ms (two runs) |
| `GET /api/todos` on the empty table | 5.6 ms, 2-byte body |

`GET /api/todos` latency over 30 sequential in-page fetches against the empty table:

| p50 | p95 | max | n |
| --- | --- | --- | --- |
| 3.6 ms | 5.8 ms | 6.8 ms | 30 |

p95 of 5.8 ms is ~86× inside the ≤500 ms localhost budget and in line with the 1.4 slice.

**No layout shift when the first row lands.** A buffered `layout-shift` `PerformanceObserver` was
installed on the empty board, one todo was then added, and CLS was re-read after the row settled:

```
cls before first add: 0
cls after  first add: 0
```

The two column boxes are byte-identical before and after the row appears
(`{x:88,y:144,w:520,h:624}` and `{x:672,y:144,w:520,h:624}` in both samples) — the empty board
already reserves the full column geometry, so the first row grows the list inside an unchanged
frame. The row itself was in the DOM **20–32 ms** after `Enter` (optimistic, ahead of the POST).

## 2. Coverage — both gates, with the empty branch covered (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (212 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 93.91% lines (108/115), 86% branch | 70% | Vitest `coverage.thresholds.lines: 70` |

Test counts: backend **39 passed** (was 38), frontend **25 passed** (was 23), E2E **4 journeys**
passed (was 3). Three tests added, exactly the epic's Story 1.5 test table (one backend integration,
two frontend, one E2E; the unit row is `none`).

The empty branch specifically:

| Path | Covered by |
| --- | --- |
| `repository.list_todos` returning no rows → `[]` on the wire | `test_list_on_an_empty_table_returns_a_bare_empty_array` (status 200, `content-type: application/json`, body exactly `[]`) |
| `useTodos` partitioning an empty list into `active: []` / `completed: []` | `the empty board › renders both labelled columns with no rows and no empty-state copy on a cold open` |
| `TodoColumn` rendering `h2` + empty `ul` with zero todos, and nothing else | same test — both columns are asserted to have exactly the element children `[H2, UL]` |
| `useTodos.deleteTodo` removing the last remaining row and the board settling back to the empty rendering | `the empty board › returns to that same board when the last todo is deleted` |
| `TodoRow.moveFocusOut`'s no-neighbour fallback to the add-bar input | same test — the focus assertion is the only case in the suite that deletes a row with no sibling |

`useTodos.deleteTodo`'s `setError(null)` is *not* attributed here: the return-to-empty case never
enters an error state, and removing that line fails only the pre-existing rollback case
(`re-inserts the deleted row at its original index and surfaces the message`).

Per-file, the files this story exercises that report **100% lines** are `App.tsx`,
`components/AddBar.tsx`, `components/TodoColumn.tsx` and `components/TodoRow.tsx` — none of them
appears in the uncovered-lines table. The two files that do are unchanged from 1.4:
`useTodos.ts` at 95.83% (lines 115, 138, 147 — the three "nothing to do" early returns) and
`api/client.ts` at 81.81% (the four stubbed one-liners, covered end to end by the Playwright
journeys).

## 3. Accessibility — axe-core on the empty board plus focus placement (UX-DR3, UX-DR6, NFR-4)

**Verdict: PASS**

**axe-core 4.13.0** (`@axe-core/playwright` 4.13.0, Chromium against `http://localhost:8080`,
rule set `wcag2a, wcag2aa, wcag21a, wcag21aa`) on the empty board:

```json
{ "violations": [], "incomplete": [], "passes": 17 }
```

Zero violations and zero incomplete results. The `color-contrast` finding carried through
1.2–1.4 is scoped to a completed row's `.label` (`--color-text-done` on `--color-canvas`); the empty
board renders no rows, so it does not arise here. A second scan taken after the journey's first add
(one active row) is also clean — `{ "violations": [], "passes": 18 }`.

**Focus placement.** On the empty board, with no click:

```json
{ "activeElement": { "tag": "INPUT", "aria-label": "New todo" } }
```

The focused input is the empty board's only affordance (UX-DR3), and it is reached without user
action — asserted both on the cold open and after the last row is deleted, which is the only path
through `TodoRow.moveFocusOut`'s no-neighbour fallback. The complete set of interactive controls
under `main` on the empty board is:

```json
["BUTTON:Add todo", "INPUT:New todo"]
```

Exactly two, both with accessible names, matching the acceptance criterion that the `New todo` input
is the only interactive control besides `Add todo`. Both section labels remain exposed as headings
(`heading[name=TODO]`, `heading[name=DONE]`) and both lists keep their accessible names via
`aria-labelledby`, so a screen-reader user perceives two named, empty lists rather than a blank page.

**No empty-state copy.** The full rendered text of `main` on the empty board is:

```
+TODODONE
```

That is the `+` button plus the two section labels and nothing else — no onboarding sentence, no
illustration caption, no count, no "0 items" hint (UX-DR6/DR7).

The guard is both textual and structural, in both suites: the whole-region text pattern
(`/^\s*\+\s*TODO\s*DONE\s*$/`), a count of zero `img`/`svg`/`picture`/`canvas` under `main`, and an
assertion that each empty `section.column` has exactly the element children `[H2, UL]` — so a
wordless illustration or a placeholder row is caught as surely as a sentence is.

**Mutation-proven.** Inserting `{todos.length === 0 && <img src="/empty.svg" alt="Nothing to do
yet" />}` above the `ul` in `TodoColumn` leaves the text-only guard green but fails both empty-board
cases against the structural guard (`2 failed | 23 passed`); the mutation was then reverted.
Separately, deleting the `moveFocusOut(event.currentTarget)` call from `TodoRow` fails the
return-to-empty focus assertion together with the 1.4 neighbour-focus case (`2 failed | 23 passed`),
confirming the focus assertion is load-bearing and not incidentally satisfied.

## 4. Security — the empty response leaks no schema or count metadata (AD-4, NFR-6)

**Verdict: PASS**

`GET /api/todos` against an empty table, through nginx:

```
HTTP/1.1 200 OK
Server: nginx/1.30.4
Content-Type: application/json
Content-Length: 2
Connection: keep-alive

[]
```

And directly against the backend container, bypassing the edge:

```
200 {'server': 'uvicorn', 'content-length': '2', 'content-type': 'application/json'} b'[]'
```

- The body is exactly the two bytes `[]` — a bare array, not `{"items": []}`, not `{"data": [], "count": 0}`, no `null`.
- Status is `200`, never `404` and never an error envelope: emptiness is a valid state, not an error.
- No count, total, page, cursor or `X-Total-Count` header — nothing tells a caller how many rows the
  table would have held or what the row shape is. An unauthenticated observer learns only that the
  endpoint exists and returned a list.
- No column names, no owner/`user_id` hint, no SQL, no stack trace, no file path, no request echo.
  The scope seam (AD-11) stays invisible: the empty body has no field through which it could leak.
- The 404 path is unchanged and still uses the single envelope —
  `DELETE /api/todos/00000000-0000-4000-8000-000000000000` →
  `{"error":"NOT_FOUND","message":"Todo not found."}`, no id echo beyond the caller's own input, no detail.
- `/openapi.json` and `/docs` are not reachable through the edge: nginx serves the SPA
  `index.html` (`Content-Type: text/html`, 427 bytes) for both, so the schema is not published to the
  browser origin.

No new endpoint, query parameter or response field was added by this story, so the attack surface is
byte-identical to 1.4.

## 5. Functional — real Chrome, zero console errors, no failed requests (FR-1, FR-3, FR-6, UX-DR9)

**Verdict: PASS**

A real Chromium page was driven through the empty-board journey with `console`, `pageerror`,
`requestfailed` and every `response` with status ≥ 400 collected:

```json
{ "consoleErrors": [], "failedRequests": [] }
```

Zero console errors, zero page errors, zero failed or ≥400 responses across cold open, two viewport
changes and the first add.

Behaviour observed:

| Step | Result |
| --- | --- |
| Cold open on an empty table | Both `TODO` and `DONE` headings and both empty lists render; no `role="status"` remnant, no `role="alert"` |
| Focus | `New todo` input focused with no click |
| Rendered copy | `+TODODONE` and nothing else |
| Layout at 1280px | Two columns side by side (boxes taken from each role-named list's ancestor `section`, so "TODO first" is verified by name, not DOM index): `{x:88,y:144,w:520,h:624}` and `{x:672,y:144,w:520,h:624}` — same `y`, second `x` greater, both non-zero |
| Layout at 320px | Stacked, TODO first: `{x:24,y:136,w:272,h:304}` then `{x:24,y:472,w:272,h:304}` — same `x`, second `y` greater, neither collapsed |
| First add from empty | `Water the plants` becomes the single TODO row in 20–32 ms; DONE stays empty and keeps its label |
| Return to empty (delete of the last row) | Covered in jsdom by the second frontend case, and end to end by `complete-and-delete.spec.ts`, which deletes the only todo and reloads onto zero rows in both columns |

`make ci` was run end to end: Ruff check and format clean, frontend `tsc --noEmit` clean, backend
39 tests with 99% coverage, frontend 25 tests with 93.91% lines, and all **four** Playwright journeys
green with the compose profile torn down with `--volumes`.

---

## Change surface

```
$ git diff --stat 1a5666c -- backend/app frontend/src \
    ':(exclude)*.test.tsx' ':(exclude)frontend/src/setupTests.ts'
(no output)
```

The pathspec is the whole production surface of both sides with only the test files excluded, so it
covers `frontend/src/App.tsx` and `frontend/src/main.tsx` as well as `components/`, `hooks/`,
`api/` and `styles/`.

No production file changed. The story is assertions only: `backend/tests/test_todos_api.py`
(empty-list contract extracted into its own test, the prelude dropped from the newest-first test),
`frontend/src/App.test.tsx` (`describe('the empty board')` with the cold-open and return-to-empty
cases) and `e2e/tests/empty-state.spec.ts` (the single new journey, self-resetting through the same
`py(CLEAR)` docker-exec helper). No layout change was needed — the E2E box assertions passed against
`.columns` as it stands.

## Decisions a reviewer should spot-check

- **AD-1** — layering untouched; no component gained a filter, sort or API call.
- **AD-4** — the list success body is a bare array, `[]` when empty, asserted at the integration layer.
- **AD-11** — the scope seam stays absent from the response shape, including the empty one.
- **AD-13** — both coverage gates enforced by tooling, both green, with the empty branch named above.
- **UX-DR6/DR7** — no empty-state copy, illustration, count or new heading level; pinned by a
  whole-region text assertion in both suites.
- **UX-DR9** — two columns ≥640px, stacked below, neither collapsing on an empty board.
