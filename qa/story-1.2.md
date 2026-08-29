# Agentic QA — Story 1.2: View the Todo Board

**Story:** 1.2 — View the Todo Board
**Date:** 2026-08-29
**Verdict:** PASS (5 / 5 checks, one non-blocking accessibility finding recorded)

| Check | Verdict |
| --- | --- |
| Performance | PASS |
| Coverage | PASS |
| Accessibility | PASS (with a recorded design-token contrast finding) |
| Security | PASS |
| Functional (real Chrome) | PASS |

All measurements below were taken against the `test` compose profile (nginx `:8080` →
backend `:8000` → tmpfs SQLite), seeded with 51 rows.

---

## 1. Performance — list latency and first render (NFR-1)

**Verdict: PASS**

`GET /api/todos` through the full edge path (nginx `/api` proxy), 60 samples, 51 rows:

| Metric | Measurement |
| --- | --- |
| p50 | 3.3 ms |
| p95 | 6.1 ms |
| max | 25.9 ms |
| Rows returned | 51 |

Board render, read from the live page (`performance` API, Chrome, nginx build):

| Metric | Measurement |
| --- | --- |
| `domContentLoaded` | 70 ms |
| `load` | 71 ms |
| first-paint | 76 ms |
| first-contentful-paint (loading indicator, then 51 rows) | 100 ms |

p95 of 6.1 ms is ~80× inside the ≤500 ms localhost budget.

## 2. Coverage — both gates, with the story's files named (AD-13)

**Verdict: PASS**

| Side | Real number | Gate | Enforced by |
| --- | --- | --- | --- |
| Backend | 99% lines (166 statements, 2 missed) | 70% | `coverage report`, `fail_under = 70` |
| Frontend | 95.23% lines (40/42) | 70% | Vitest `coverage.thresholds.lines: 70` |

Per-file numbers for the files this story touched:

| File | Lines |
| --- | --- |
| `backend/app/repository.py` | 100% (7/7) |
| `backend/app/routers/todos.py` | 100% (14/14) |
| `backend/app/services.py` | 100% (15/15) |
| `frontend/src/hooks/useTodos.ts` | 100% (17/17) |
| `frontend/src/components/TodoColumn.tsx` | 100% (2/2) |
| `frontend/src/components/TodoRow.tsx` | 100% (1/1) |
| `frontend/src/api/client.ts` | 94.73% (18/19) — `listTodos` is covered end to end by the E2E journey, not by a unit test |

**Fetch-failure path is covered.** `useTodos`'s `.catch` is exercised by
`useTodos.test.ts` — a rejected `ApiRequestError` leaves `loading` false, `error` set to the
server message, and both partitions empty, with `App` rendering that message above the columns
rather than blanking the list area. Story 1.6 still owns the retry affordance and its test; this
covers only the I/O matrix's failure row.

**Mutation proof that the new assertions are load-bearing** — each mutation applied, suite run,
source restored:

| Mutation | Result |
| --- | --- |
| Drop `.order_by(col(Todo.created_at).desc())` from `repository.list_todos` | backend: **2 failed**, 13 passed |
| Invert the owner filter to `col(Todo.user_id).is_not(None)` | backend: **2 failed**, 13 passed |
| Return `todos` unpartitioned as `active` from `useTodos` | frontend: **2 failed**, 8 passed |
| Start `useTodos` with `loading = false` | frontend: **2 failed**, 8 passed |
| Swallow the error in `useTodos`'s `.catch` (`setError(null)`) | frontend: **1 failed**, 10 passed |

**Owner filter, verified rather than assumed.** The spec's Design Note warns that
`where(Todo.user_id == owner)` must compile to `IS NULL` for the v1 implicit owner. Confirmed by
compiling the statement: `... WHERE todo.user_id IS NULL ORDER BY todo.created_at DESC`. SQLAlchemy
renders `IS NULL` for a `None` value and `= :param` for a real id, so the single expression serves
both the v1 owner and the AD-15 seam — no branch, no dead arm.

## 3. Accessibility — populated board (UX-DR8, NFR-5)

**Verdict: PASS**, with one recorded finding.

Run with **axe-core 4.13.0** (the exact build bundled with the pinned `@axe-core/playwright`
4.13.0, served from the running container, not a CDN), in Chrome against `http://localhost:8080`,
rule set `wcag2a, wcag2aa, wcag21a, wcag21aa`, 51 rows on the board:

```json
{ "axeVersion": "4.13.0", "passes": 18, "incomplete": ["color-contrast"],
  "violations": [ { "id": "color-contrast", "impact": "serious", "nodes": 17,
                    "sample": "<span class=\"label\">Realistic todo 48</span>",
                    "data": { "fgColor": "#555555", "bgColor": "#000000",
                              "contrastRatio": 2.81, "expectedContrastRatio": "4.5:1" } } ] }
```

**The single violation is the DESIGN.md `--color-text-done` token**, `#555555` on the black
canvas — 2.81:1 against AA's 4.5:1 — reported once per completed row and nowhere else. It is
**not** a defect introduced by this story and it is **not** treated as a gate:

- The epic states WCAG 2.1 AA is a **stretch goal, not a gate**, and the accessibility floor is
  "completion perceivable without color alone". That floor is met three times over — see below.
- `--color-text-done` is fixed by `DESIGN.md` and declared once in `tokens.css`. Changing it is a
  design decision, not an implementation one, so it is recorded here rather than silently altered.
- Consequently the Playwright journey asserts the board, not axe: an axe assertion in the E2E
  would fail on a sanctioned design token. Recommended follow-up for the UX owner: raise
  `--color-text-done` to ≥ `#767676` (4.54:1 on black) to clear AA with no other change.

**Completion is conveyed three ways, none of them colour:**

| Signal | Observed |
| --- | --- |
| Strikethrough | `.row.done .label` computed `text-decoration-line: line-through` |
| Checkbox state | `checked` true, accessible name `Mark incomplete` (vs `Mark complete` when active) |
| Column placement | the row lives under the `DONE` list, not `TODO` |

**Names and focus order**, read from the live page with 51 rows (104 focusable controls):

| Requirement | Observed |
| --- | --- |
| Controls without an accessible name | **0 of 104** |
| Positive `tabindex` anywhere | **0** — DOM order is tab order |
| Focus on load | the `New todo` textbox |
| Tab order | `Add todo` → `New todo` → then, per row, `Mark complete` → `Delete` — the add bar first, then TODO's rows, then DONE's |
| Lists exposed with names | `ul.list` wired via `aria-labelledby` to the `TODO` / `DONE` headings |
| Document basics | `lang="en"`, title `Todo`, exactly one `<main>` landmark |

## 4. Security — injection surface (AD-16)

**Verdict: PASS**

A todo whose description is `<script>alert(1)</script> & "quoted" <b>bold</b>` was persisted and
the board loaded in Chrome:

| Assertion | Evidence |
| --- | --- |
| Rendered as literal text | the `.label` `textContent` is the raw string, byte for byte |
| No markup was parsed | that `.label` has **0 child elements**; `document.querySelector('.label script, .label b')` → `null` |
| No script executed | zero console messages, no dialog |
| No `dangerouslySetInnerHTML` / `innerHTML` | grep over `frontend/src` → no matches |
| List query uses SQLModel expressions only | `select(Todo).where(...).order_by(col(Todo.created_at).desc())`; no f-string, no concatenation, no `text()` |
| All SQL confined to the repository | `grep -rn 'order_by\|select(' backend/app` → only `repository.py:7` and `repository.py:13` |
| Owner column never leaves the server | the response body keys are exactly `{id, description, completed, createdAt}`; `TodoRead` does not declare `user_id` |
| Single request site, relative only | `grep -rn 'fetch(' frontend/src` (non-test) → only `api/client.ts:18`; `grep -rn 'http://' frontend/src` → no matches |
| No hard-coded hex outside `tokens.css` | `grep -rniE '#[0-9a-f]{6}' frontend/src --include='*.ts*'` → no matches |

## 5. Functional in real Chrome (Chrome DevTools MCP)

**Verdict: PASS**

`test` profile, nginx at `http://localhost:8080`, 51 seeded rows:

| Check | Observed |
| --- | --- |
| Console messages | **none** — zero errors, zero warnings |
| Network requests | 4, all `200`: `/`, the hashed JS bundle, the hashed CSS bundle, `/api/todos` |
| Requests to another origin | **none** — every resource URL starts with the page origin |
| API path on the wire | exactly `http://localhost:8080/api/todos` — relative `/api/*` through the nginx proxy (AD-5) |
| Columns | `TODO` and `DONE` headings; 34 rows left, 17 right — the hook's partition, matching the seed |
| Ordering | first TODO rows are the newest `createdAt` first (`…09:39` injected row, then `Realistic todo 49`, `47`, …); DONE likewise (`48`, `45`, `42`) |
| Strikethrough on completed rows | computed `text-decoration-line: line-through`, colour `rgb(85, 85, 85)` = `--color-text-done` |
| Checkbox semantics | active rows `Mark complete`/unchecked, completed rows `Mark incomplete`/checked |
| Inert controls | the checkbox and `×` render but do nothing — 1.3/1.4 own them, per the spec's Never list |

---

## Ad-hoc checks

| Check | Result |
| --- | --- |
| **Breakpoint sweep — 641px** | `.columns` computes `240.5px 240.5px`, two equal side-by-side tracks; TODO at `x=48` left of DONE at `x=353`, both at the same `y`. `scrollWidth === innerWidth` — no horizontal overflow. App padding `32px 48px`. |
| **Breakpoint sweep — 320px** | `.columns` computes a single `272px` track; TODO at `y=136` stacked above DONE at `y=1976`, TODO first. Widest row right edge 296px inside a 320px viewport — nothing clipped. App padding drops to `24px` (`--space-5`). |
| Empty table | `GET /api/todos` against a fresh database returns `200 []` (asserted in `test_list_returns_a_bare_array_newest_first`); the board renders both labelled columns with zero rows and no empty-state copy — Story 1.5 owns that surface and its answer is still "no copy". |
| Loading indicator | `App` renders `role="status"` "Loading…" while `useTodos.loading` is true and swaps to the columns once the promise settles; asserted in `App.test.tsx` against a promise held unresolved. Never a blank page. |
| E2E self-reset | `view-board.spec.ts` clears the table in `beforeAll` **and** `afterAll` through `docker compose exec backend python`, so it is order-independent and leaves nothing behind. Only `GET` exists this story, so no API seeding route is available and no test-only route was added to application code. |
| Presentational purity | `grep -n 'useState\|useEffect\|client\|filter\|sort' frontend/src/components/*.tsx` → no matches. Both components take props and render. |
| `make lint` | Exit 0 — Ruff check, Ruff format check, `tsc --noEmit` |
| `make test-backend` | 15 passed; `coverage report` 99%, gate fires |
| `make test-frontend` | 11 passed (3 files) |
| `make test-e2e` | `view-board.spec.ts` passed; profile torn down with `--volumes` |
| `make ci` | **Exit 0** |
