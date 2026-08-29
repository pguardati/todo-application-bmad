---
title: 'Story 1.5 — Intentional Empty State'
type: 'feature'
created: '2026-08-29'
status: 'in-progress' # draft | ready-for-dev | in-progress | in-review | done | blocked
baseline_revision: '1a5666c3bf73c40f530b7bc23afdccced7105b98'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The board with no todos is currently an accident of the read slice, not a guaranteed
surface: nothing pins that `GET /api/todos` answers a bare `[]` for its own sake, that both column
labels still render with zero rows and no empty-state copy, that the add bar holds focus, or that
deleting the last todo returns the board to exactly that presentation instead of stranding a loading
or error remnant.

**Approach:** Close the epic's Story 1.5 test rows around the existing composition — one backend
integration case for the empty list contract, two frontend cases (cold empty render, return-to-empty
after the last delete), and one Playwright journey — plus the agentic QA report. Production code
changes only if one of those assertions exposes a real gap; the empty board is meant to fall out of
the 1.2 composition, and the epic's own test table lists no production task.

## Boundaries & Constraints

**Always:**
- The empty board is the same components as the populated board: both `TodoColumn`s render their
  `h2` section label and an empty `ul`, the add bar sits above them and keeps focus, and `useTodos`
  stays the sole partitioner.
- `GET /api/todos` on an empty table answers `200` with a bare `[]` — never `404`, never an error
  envelope, never a wrapper object or count metadata.
- Design tokens only (`var(--token)`); no new hex, no new heading levels, no new microcopy string.
- Any production change must be the minimum the failing assertion demands and must reuse existing
  tokens and existing class names.

**Block If:**
- `make ci` fails for a reason outside this story's change surface.
- An empty-board assertion can only be satisfied by adding user-visible copy, an illustration, or a
  new heading — that would contradict UX-DR6/DR7 and is not resolvable unattended.

**Never:**
- No empty-state copy, illustration, onboarding text, placeholder row, count, or "0 items" hint.
- No new endpoint, no query parameter, no response envelope change.
- Do not touch the error/retry surface (1.6) or add an undo.
- Do not add tests beyond the epic's Story 1.5 test table — that table is the complete test scope.
  The unit row is explicitly `none`; exactly one new E2E journey.
- Do not re-filter or re-sort in components.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty list contract | `GET /api/todos` against an empty table | `200`, body is exactly `[]`, `content-type: application/json`; no error envelope, no wrapper, no count | No error expected |
| Cold empty open | Stubbed client resolves `[]` | Both `TODO` and `DONE` headings and their lists render with zero `listitem`s; no `role="status"`, no `role="alert"`; the add bar input holds focus | No error expected |
| No empty-state copy | Cold empty open | The DOM under `main` carries no text beyond `+`, `TODO` and `DONE` — no empty/onboarding string | No error expected |
| First add from empty | Empty board, submit `Water the plants` | Row appears at the top of TODO; DONE stays empty; both columns still present | Existing create rollback path, untouched |
| Return to empty | One todo remains, its `×` clicked and the delete confirms | Board renders exactly as the cold empty open: both labels, zero rows, no `role="status"`, no `role="alert"` | Existing delete rollback path, untouched |
| Empty board layout | Empty board at 1280px and at 320px | Two columns above 640px, stacked below; every column has non-zero width and height | No error expected |

</intent-contract>

## Code Map

Backend (under `backend/`):
- `tests/test_todos_api.py:27-30` -- the empty-list assertion currently lives as a prelude inside
  `test_list_returns_a_bare_array_newest_first`. Extract it into its own test named for the empty
  contract (status `200`, body `== []`, JSON content type) and leave the newest-first test to assert
  only ordering on seeded data. `conftest.py`'s temp-file `engine` and async `client` fixtures are
  reused verbatim; `seed()` at `:13-24` is unchanged.
- `app/routers/todos.py`, `app/services.py`, `app/repository.py` -- read-only for this story. The
  list path already returns a bare list; no change is expected in any of them.

Frontend (under `frontend/`):
- `src/App.tsx:8-38` -- the composition under test: `AddBar` always mounted, the alert only when
  `error`, the `Loading…` `role="status"` only while `loading`, and both `TodoColumn`s otherwise.
  Read-only unless an assertion proves a gap.
- `src/components/TodoColumn.tsx:13-25` -- renders the `h2` label and a `ul` even with zero todos;
  this is what makes the empty board a real surface. Read-only.
- `src/components/AddBar.tsx:19-38` -- `autoFocus` on the `New todo` input is the empty board's only
  affordance (UX-DR3). Read-only.
- `src/hooks/useTodos.ts:158-166` -- `active`/`completed` both partition to `[]`; `setError(null)` on
  a successful delete is what keeps the return-to-empty board clean. Read-only.
- `src/App.test.tsx:10-36` -- the `vi.mock('./api/client', importOriginal)` factory and the
  per-test `mockReset` block; add a new `describe('the empty board')` with the epic's two frontend
  rows using this exact pattern, `rows` and `saved()` helpers included.
- `src/styles/app.css:76-81,140-149` -- `.columns` (grid `1fr 1fr`, `flex: 1`) and the ≤640px stack.
  These carry the empty-board layout criterion; change only if the E2E box assertion fails.
- `e2e/tests/complete-and-delete.spec.ts:1-30` -- the `py(CLEAR)` docker-exec helper and the
  self-resetting `beforeAll`/`afterAll`. Copy that harness into `e2e/tests/empty-state.spec.ts`,
  which needs `CLEAR` only (its precondition *is* the empty table) and seeds nothing.
- `e2e/tests/view-board.spec.ts:46-63` -- the `getByRole('list', { name: 'TODO' })` locator style to
  match.
- `qa/story-1.4.md` -- the report format (verdict table, then one section per check with evidence)
  to follow for `qa/story-1.5.md`.
- `Makefile:23-49` -- `lint`, `coverage`, `test-e2e`, `ci`. Unchanged; new tests run under the
  existing targets.

## Tasks & Acceptance

**Execution:**
- `backend/tests/test_todos_api.py` -- extract the epic's backend row into a standalone empty-list
  test (`200`, exactly `[]`, JSON content type) and drop the now-duplicated prelude from the
  newest-first test -- FR-1, AD-4.
- `frontend/src/App.test.tsx` -- add the epic's two frontend rows: (1) cold empty render — stubbed
  `listTodos` resolves `[]`, both headings and both lists present with zero `listitem`s, no
  `role="status"` and no `role="alert"`, the `New todo` input is `document.activeElement`, and the
  rendered text carries no empty-state copy; (2) return to empty — one todo, its `×` clicked,
  `deleteTodo` resolves, and the board matches that same rendering with no residual status or alert
  -- FR-1, FR-6, UX-DR6.
- `e2e/tests/empty-state.spec.ts` -- the epic's single journey: clear through the same `py(CLEAR)`
  helper in `beforeAll`/`afterAll`, load the board, assert both labels with zero rows and no
  empty-state copy, assert both columns have non-zero bounding boxes at 1280px and stacked at 320px,
  then add one todo and assert the board transitions cleanly to populated with DONE still empty --
  UX-DR6, UX-DR9, NFR-8.
- `frontend/src/styles/app.css` -- only if the layout assertion fails: keep both columns non-collapsed
  using existing spacing tokens; otherwise leave untouched -- UX-DR9.
- `qa/story-1.5.md` -- the agentic QA report with a verdict and evidence for each of the five checks
  (performance on empty cold open with no layout shift when the first row lands, coverage with both
  gates and the empty branch covered, accessibility via axe-core on the empty board plus focus
  placement, security showing the empty response leaks no schema or count metadata, and functional in
  real Chrome with zero console errors and no failed requests).

**Acceptance Criteria:**
- Given the frontend source, when the empty-board tests run, then no string outside `+`, `TODO`,
  `DONE` and the add-bar accessible names is rendered on an empty board — an added empty-state
  paragraph fails the assertion.
- Given `git diff` for this story, when the production files are inspected, then any change under
  `backend/app` or `frontend/src` (excluding tests) is justified by a named failing assertion, and
  no new hex, heading level, endpoint or microcopy string appears anywhere.
- Given the empty board, when the page loads, then the `New todo` input holds focus without a click,
  and it is the only interactive control besides the `Add todo` button.
- Given the empty board at 1280px, when rendered, then TODO and DONE sit side by side with non-zero
  width and height; at 320px they stack with TODO first and neither collapses.
- Given a board holding one todo, when it is deleted and the delete confirms, then the resulting DOM
  matches the cold empty open — no `role="status"`, no `role="alert"`, both labels present.
- Given `make ci`, when it runs, then lint, both suites with their ≥70% line gates, and all four
  Playwright journeys pass.
- Given the story is complete, when the work is published, then a branch cut from
  `story-1.4-complete-and-delete-a-todo` carries the change, a pull request targets that branch naming
  the story, FR-1/FR-3/FR-6 and the ADs to spot-check (AD-1, AD-4, AD-11, AD-13), and `qa/story-1.5.md`
  records the five agentic checks.

## Spec Change Log

## Review Triage Log

## Design Notes

**Why this slice is mostly assertions.** The empty board is the 1.2 composition with two empty
lists; the epic's Story 1.5 test table lists no production task, and UX-DR6 forbids the copy that a
naive empty state would add. The story's value is that the presentation is now pinned: a later change
that blanks a column, strands the loading line, or adds onboarding text breaks a test.

**Detecting empty-state copy without asserting on a string.** Rather than a fragile
`queryByText(...)` per candidate phrase, assert the whole rendered text of the board region:

```ts
const main = screen.getByRole('main')
expect(main).toHaveTextContent(/^\s*\+\s*TODO\s*DONE\s*$/)
```

This fails the moment any illustration caption, hint or count is introduced, and needs no list of
forbidden phrases.

**E2E self-reset.** `empty-state.spec.ts` reuses the `py(CLEAR)` docker-exec helper in
`beforeAll`/`afterAll` and seeds nothing — an empty table is its precondition — so the four journeys
stay order-independent under `make test-e2e`, which tears the profile down with `--volumes`. The
todo it adds is removed by its own `afterAll`.

## Verification

**Commands:**
- `make lint` -- expected: Ruff check and format plus the frontend typecheck exit zero.
- `make test-backend` -- expected: the standalone empty-list test passes alongside 1.1–1.4;
  `coverage report` stays ≥70%.
- `make test-frontend` -- expected: the two new empty-board cases pass; line coverage ≥70%.
- `make test-e2e` -- expected: all four journeys pass and the profile is torn down.
- `make ci` -- expected: the full chain is green.
- `git diff --stat 1a5666c3bf73c40f530b7bc23afdccced7105b98 -- backend/app frontend/src/components frontend/src/hooks frontend/src/api`
  -- expected: empty, or a single justified change named in the PR.
- `curl -s -i localhost:8000/api/todos` against an empty database -- expected: `200`,
  `content-type: application/json`, body exactly `[]`, no count header, no wrapper.
