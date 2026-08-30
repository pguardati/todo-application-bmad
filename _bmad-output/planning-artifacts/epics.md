---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-bmad-todo-application-typescript-2026-08-24/prd.md
  - _bmad-output/planning-artifacts/prds/prd-bmad-todo-application-typescript-2026-08-24/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-bmad-todo-application-typescript-2026-08-28/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-bmad-todo-application-typescript-2026-08-24/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-bmad-todo-application-typescript-2026-08-24/EXPERIENCE.md
---

# todo-application-bmad - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for todo-application-bmad, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Display the full Todo List on initial load, with first-class loading, empty, and error states (error categories: unreachable API, 500, 400) and a retry action.
FR-2: Distinguish active from completed Todos visually (strikethrough / reduced emphasis) and expose Completion Status to assistive technology.
FR-3: Create a Todo from a short text Description; submit via primary button or Enter; reject empty/whitespace and >200 characters client-side with no API call; new Todo appears at top; input clears on success.
FR-4: Optimistic create with rollback — on API failure the optimistic Todo is removed, a recoverable error is shown, and the typed text is preserved.
FR-5: Toggle Completion Status in one action, optimistically with rollback; change persists across refresh and new sessions.
FR-6: Delete any Todo permanently via an explicit per-row control, optimistically with rollback; deleted Todos do not reappear after refresh.
FR-7: Persist Todos via a CRUD API — list, create, update completion, delete; durable storage surviving restart; consistent error codes `VALIDATION_ERROR` / `NOT_FOUND` / `INTERNAL_ERROR`; server-side rejection of empty or >200-char Description; Description immutable after creation in v1.

### NonFunctional Requirements

NFR-1 (Performance): Optimistic mutations reflect in UI ≤100ms locally; p95 API round-trip ≤500ms on localhost.
NFR-2 (Reliability): No silent data loss — the user always knows when an action failed.
NFR-3 (Maintainability): Clear Client/API separation, minimal dependencies, single documented start command.
NFR-4 (Deployment): Local-only for v1 — file-based local persistence, no cloud hosting.
NFR-5 (Accessibility): All interactive controls keyboard-operable; completion perceivable without color alone; reasonable focus order. WCAG 2.1 AA is a stretch goal, not a gate.
NFR-6 (Security): Server-side validation enforced regardless of client; no secrets in the Client bundle.
NFR-7 (Extensibility): Todo entity and API allow a future `userId` without migration pain.
NFR-8 (Responsive): List layout readable from 320px width upward through desktop widths.

### Additional Requirements

Architecture (`ARCHITECTURE-SPINE.md`) — binding invariants and infrastructure:

- AD-1 Layered dependency direction: `components → hooks/useTodos → api/client`; `routers → services → repository → models`. No sibling imports within a layer.
- AD-2 One contract authority (`backend/app/schemas.py`), one hand-written mirror (`frontend/src/api/types.ts`).
- AD-3 camelCase on the wire via a shared camelCase alias-generator base; snake_case in Python; no per-field aliases.
- AD-4 One error envelope `{error, message}` produced only by exception handlers in `main.py` from an `AppError` hierarchy; 422 remapped to 400 `VALIDATION_ERROR`; unhandled → 500 `INTERNAL_ERROR`; client renders server `message` verbatim with one local network-failure fallback.
- AD-5 Same-origin `/api/*` only, routed at the edge (Vite proxy in dev, nginx in test); no API host env var; no CORS middleware.
- AD-6 `useTodos.ts` is the only holder of todo state and only caller of `api/client.ts`; per-todo optimistic revert only (no whole-list snapshot); hook exposes pre-partitioned `active` / `completed`.
- AD-7 Server-generated UUIDv4 ids; optimistic rows carry a client-only temp key with controls disabled until confirmation.
- AD-8 Schema created by `SQLModel.metadata.create_all()` on startup; no migration tool; `make db-reset` for non-additive changes.
- AD-9 All SQL in `repository.py`; one session-per-request FastAPI dependency that commits or rolls back; repository flushes/refreshes and never commits.
- AD-10 Validation authoritative server-side (1–200 chars, trimmed), mirrored client-side from one exported constant; no other literal `200` in validation code.
- AD-11 Fixed test layers: backend integration (pytest + `httpx.ASGITransport`, real temp SQLite, every endpoint and error code), backend unit (branching service rules only), frontend component/hook (Vitest + Testing Library against a stubbed `api/client`, every rollback path), E2E (Playwright against compose `test` profile, journeys only, axe-core accessibility). E2E specs order-independent and self-resetting via the API. Only Playwright may start a live server.
- AD-12 One health contract `GET /api/health` → `200 {"status":"ok","database":"ok"}` / `503`; used by Docker `HEALTHCHECK` and compose `depends_on`.
- AD-13 The root `Makefile` is the only entrypoint (`install`, `dev`, `test`, `test-backend`, `test-frontend`, `test-e2e`, `lint`, `coverage`, `db-reset`, `ci`); GitHub Actions on `pull_request` invokes `make` targets only; backend and frontend each gate at ≥70% line coverage, tool-enforced.
- AD-14 One `docker-compose.yml` with profiles `dev` and `test`; all backend config read once into a typed `Settings` in `config.py`; no direct `os.environ`; working defaults for dev; no committed secrets.
- AD-15 Auth-ready without auth: nullable `user_id` column absent from v1 response schemas; a single `current_scope` dependency supplies the implicit v1 owner.
- AD-16 Security baseline: SQLModel expressions only (no string-built SQL, no `text()`), React default escaping only (no `dangerouslySetInnerHTML` / `innerHTML`), no stack traces or request bodies in responses or logs, non-root containers, `.env` git-ignored with `.env.example` placeholders.
- Stack pins: Python 3.13, FastAPI 0.141.1, SQLModel 0.0.39, Pydantic 2.13.4, Uvicorn 0.52.4, pytest 9.1.1, httpx 0.28.1, Ruff 0.16.5, uv 0.12.x, Node 24 LTS, React 19.2.8, TypeScript 7.0.2, Vite 8.2.2, Vitest 4.1.11, Testing Library 16.3.3, Playwright 1.62.1, @axe-core/playwright 4.13.0, nginx 1.30-alpine, Docker Compose v2.
- Fixed ports: backend 8000, Vite 5173, nginx 8080.
- Source tree and conventions: entity named `Todo` everywhere; UTC ISO 8601 timestamps; bare resource/array success bodies; ordering always `createdAt` descending applied in `repository.py`.
- No starter template is specified — the scaffold is authored from the Structural Seed source tree.

### UX Design Requirements

UX-DR1: Declare all `DESIGN.md` tokens once as CSS custom properties in `frontend/src/styles/tokens.css` (colors canvas/text/text-muted/text-done/accent/accent-hover/border/control/control-hover, system font stack, body and section-label typography, spacing 1–8, `rounded.sm = 0`); reference only via `var(--token)`. No hard-coded hex, no CSS-in-JS, no UI framework.
UX-DR2: Single surface Todo board — no routes, no navigation chrome, no onboarding, no settings. Black canvas, two section labels only: TODO and DONE.
UX-DR3: Add bar component — `+` icon button (accent) left of a bottom-bordered text input with no placeholder; submit via Enter or `+` click; underline turns accent on `:focus-within`; add bar focused on load; new row inserts at top of TODO.
UX-DR4: Todo row component — checkbox · description · delete `×`, 1px border divider, accent checkbox; toggling moves the row between TODO and DONE; completed label gets strikethrough and `text-done`.
UX-DR5: Delete control — `×` icon button in `control` gray, `control-hover` on hover; never accent, never red styling.
UX-DR6: State treatments — loading indicator on cold open (never a blank page); populated split into TODO/DONE columns; empty state shows both columns empty with no empty-state copy (the input is the affordance); error state shows a human-readable message plus retry without a blank/broken list area.
UX-DR7: Microcopy discipline — `TODO`/`DONE` labels, `Add todo`/`Delete` as aria labels, silent rejection of empty input, no validation paragraphs or onboarding copy.
UX-DR8: Accessibility floor — accessible name on every control, checkbox state exposed to assistive tech, completion distinguishable without color alone (strikethrough + column + checkbox), accent focus-visible rings, Tab order through add bar then list controls, `+` tap target 32px.
UX-DR9: Responsive layout — ≥640px two equal columns (TODO left, DONE right); <640px stacked columns (TODO first) with reduced padding (`spacing.5`) and column gap (`spacing.6`).
UX-DR10: Flat visual language — no elevation, shadows, border radius, colored column backgrounds, extra accent hues, or additional heading levels; `mockups/main.html` is the composition reference, with the spine winning on conflict.

### FR Coverage Map

FR-1: Epic 1 — Story 1.2 (list load with loading/populated states), Story 1.5 (empty state), Story 1.6 (error state + retry)
FR-2: Epic 1 — Story 1.2 (TODO/DONE partition, strikethrough, accessible checkbox state)
FR-3: Epic 1 — Story 1.3 (create with client + server validation, top insertion, input clears)
FR-4: Epic 1 — Story 1.3 (optimistic create with rollback and text preservation)
FR-5: Epic 1 — Story 1.4 (toggle completion, optimistic, persisted)
FR-6: Epic 1 — Story 1.4 (delete, optimistic, persisted)
FR-7: Epic 1 — Story 1.1 (health + persistence substrate), Stories 1.2–1.4 (each slice adds its endpoint), Story 1.6 (error envelope)

## Epic List

### Epic 1: A Working Personal Todo Board

A user can open the app locally, see their persisted todos split into TODO and DONE, add a todo, complete or uncomplete it, delete it, and always understand what the app is doing when the list is empty or the API fails. Delivered as one walking-skeleton story plus five vertical full-stack slices, each closing with a Playwright journey and an agentic QA report.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7

**Rationale for a single epic:** Architecture, UX, and test layers are fully pre-designed and validated (AD-1 … AD-16, DESIGN/EXPERIENCE spines), so no direction change is expected between slices. Every slice touches the same core files — `useTodos.ts`, `api/client.ts`, `routers/todos.py`, `repository.py` — which per the epic-design file-overlap rule means one epic with ordered stories, not several epics churning the same components.

**Story sequence:**

1. **1.1 Scaffold** — repo skeleton, containers, Makefile, CI, health endpoint. No user-facing todo behaviour.
2. **1.2 View the todo board** — `GET /api/todos` end to end, TODO/DONE columns, loading state.
3. **1.3 Add a todo** — `POST /api/todos` end to end, add bar, validation, optimistic create with rollback.
4. **1.4 Complete and delete a todo** — `PATCH` + `DELETE` end to end, row toggle and removal, optimistic rollback.
5. **1.5 Empty state** — the no-todos board reads as intentional, not broken.
6. **1.6 Error handling** — the one error envelope surfaced as a human-readable message with retry.

**Definition of Done (every story):** a pull request opened on top of the previous story's branch, `make ci` green, and an agentic QA report written to `/qa`.

---

## Epic 1: A Working Personal Todo Board

Deliver the complete v1 Todo board: a user opens the app locally, sees their persisted todos split into TODO and DONE, adds a todo, completes or uncompletes it, deletes it, and always understands what the app is doing when the list is empty or the API fails. Story 1.1 lays the walking skeleton; stories 1.2–1.6 are vertical full-stack slices, each closing with exactly one Playwright journey and one agentic QA report.

### Shared Definition of Done (applies to every story in this epic)

Every story is only done when all of the following hold:

- **Stacked pull request** — the branch is cut from the previous story's branch (1.1 from `main`, 1.2 from 1.1, and so on), the PR targets that same previous branch, and the PR description names the story, the FRs and ADs it satisfies, and any `make db-reset` requirement per AD-8.
- **`make ci` green** — lint, backend tests, frontend tests, coverage gates (≥70% lines each side, tool-enforced per AD-13), and E2E all pass through `make` targets only.
- **Agentic QA report** — a report is written to `/qa/story-1.<M>.md` covering the five agentic checks defined for that story (performance, coverage, accessibility, security, functional-by-browser) with a pass/fail verdict per check and evidence for each.
- **No architecture drift** — the story introduces no violation of AD-1 … AD-16; the PR description states which ADs the reviewer should spot-check.

### Test Taxonomy (used by every story below)

| Layer | Tool | Question it answers |
|---|---|---|
| Unit | pytest / Vitest | Does an isolated rule with real branches behave correctly? (AD-11 — only where branches are worth isolating) |
| Integration | pytest + `httpx.ASGITransport` against a real temp SQLite file; Vitest + Testing Library against a stubbed `api/client` | Does the endpoint or the component/hook behave correctly wired to its real neighbour? |
| E2E | Playwright against the compose `test` profile | Does the whole user journey work in a real browser? Exactly one journey spec per slice. |
| Ad-hoc | Manual, documented in the PR | The one thing a human must eyeball before merge. |
| Agentic | Agent-driven, reported to `/qa` | Performance, coverage, accessibility, security, and functional-by-browser (Chrome MCP), verified by an agent rather than asserted in code. |

---

### Story 1.1: Walking Skeleton — Runnable, Testable, Deployable Shell

As a developer,
I want a running two-service skeleton with persistence, a health endpoint, one entrypoint, and a green CI pipeline,
So that every subsequent slice has somewhere to land and proves itself automatically.

**Acceptance Criteria:**

**Given** a clean checkout and no prior local setup
**When** I run `make install` then `make dev`
**Then** the backend serves on port 8000 and the Vite dev server on 5173 with `/api/*` proxied to the backend (AD-5)
**And** the source tree matches the Structural Seed exactly — `backend/app/{main,config,db,models,schemas,errors,repository,services,deps}.py`, `backend/app/routers/{todos,health}.py`, `frontend/src/{api,hooks,components,styles}`, `e2e/`, root `Makefile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`
**And** no absolute API URL and no API-host environment variable appears anywhere in frontend source or build config (AD-5).

**Given** the backend is running
**When** I request `GET /api/health`
**Then** I receive `200 {"status": "ok", "database": "ok"}` after a trivial database round-trip (AD-12)
**And** when the database is unreachable I receive `503` with the same two keys
**And** no other health or readiness endpoint exists in the codebase.

**Given** the `Todo` SQLModel table with fields `id` (UUIDv4 string PK), `description`, `completed`, `created_at`, and nullable `user_id` (AD-15)
**When** the application starts
**Then** the schema is created by `SQLModel.metadata.create_all()` alone, idempotently (AD-8)
**And** no migration framework and no raw `CREATE`/`ALTER` statement exists in the repository
**And** `user_id` is absent from every response schema.

**Given** the session dependency in `db.py`
**When** a request succeeds
**Then** the single per-request `Session` commits exactly once and closes; when the request raises, it rolls back (AD-9)
**And** no router or service constructs a `Session` or references the engine.

**Given** `docker-compose.yml` with profiles `dev` and `test` only (AD-14)
**When** I bring up the `test` profile
**Then** built images start, the frontend nginx serves on 8080 and proxies `/api`, and compose gates the frontend on `depends_on: {backend: {condition: service_healthy}}` using `/api/health` (AD-12)
**And** both images run as a non-root user (AD-16)
**And** no `docker-compose.<env>.yml` variant exists.

**Given** all backend configuration
**When** I search the backend for `os.environ`
**Then** the only reads are inside a typed `Settings` object in `config.py`, every setting has a working local default, and `.env` is git-ignored with `.env.example` carrying placeholders only (AD-14, AD-16).

**Given** the root `Makefile`
**When** I list its targets
**Then** `install`, `dev`, `test`, `test-backend`, `test-frontend`, `test-e2e`, `lint`, `coverage`, `db-reset`, and `ci` all exist and work (AD-13)
**And** `.github/workflows/ci.yml` triggers on `pull_request` and invokes `make` targets only, containing no inline `pytest`, `npm test`, or `docker compose` command
**And** coverage gates are enforced by the tools themselves (`--cov-fail-under=70`, Vitest `coverage.thresholds.lines`), not by a shell check.

**Given** `frontend/src/styles/tokens.css`
**When** I inspect it
**Then** every `DESIGN.md` token is declared once as a CSS custom property — colors, system font stack, body and section-label typography, spacing 1–8, `rounded.sm: 0` (UX-DR1)
**And** the app shell renders on the black canvas with no hard-coded hex value anywhere in frontend source, no CSS-in-JS, and no UI framework dependency.

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | `Settings` defaults | Configuration resolves with no environment variables present — the only branching rule in this story worth isolating (AD-11). |
| Integration | `test_health.py` — healthy | `GET /api/health` returns `200 {"status":"ok","database":"ok"}` against a real temporary SQLite file. |
| Integration | `test_health.py` — degraded | Returns `503` with the same two keys when the database round-trip fails. |
| Integration | `conftest.py` fixture | Establishes the per-test temp-file database fixture that every later story reuses. |
| E2E | none | This story has no user journey. The Playwright harness (`playwright.config.ts`, ports, `test` profile wiring) is created and proven by running an empty-but-passing suite. |
| Ad-hoc | Clean-clone bring-up | `make install` then `make dev` on a fresh clone: black canvas at `localhost:5173`, `/api/health` answers through the proxy. |
| Ad-hoc | Compose and reset | `docker compose --profile test up` reaches healthy; `make db-reset` recreates the database file. |
| Agentic · performance | Startup and health baseline | Cold `make dev` startup time and `/api/health` p95 latency recorded as the NFR-1 baseline. |
| Agentic · coverage | Gates actually fire | `make ci` fails when coverage is forced below 70% and passes at the story's real number (AD-13). |
| Agentic · accessibility | Empty shell | axe-core clean; document basics present — `lang`, title, one landmark. |
| Agentic · security | Baseline sweep | No committed secret, `.env` ignored, both containers non-root, no `text()` or string-built SQL, no `dangerouslySetInnerHTML` (AD-16). |
| Agentic · functional (Chrome MCP) | Shell in real Chrome | Shell renders on the black canvas at `localhost:5173` with zero console errors and zero failed network requests. |

Report → `/qa/story-1.1.md`

---

### Story 1.2: View the Todo Board

As a user,
I want to open the app and immediately see my saved todos split into TODO and DONE,
So that I know what is still open and what I have finished without doing anything.

**Acceptance Criteria:**

**Given** persisted todos exist
**When** I request `GET /api/todos`
**Then** I receive a bare JSON array of todos ordered by `createdAt` descending, with the ordering applied in `repository.py` (AD-9, ordering convention)
**And** each item is camelCase `{id, description, completed, createdAt}` with `createdAt` a UTC ISO 8601 string with offset (AD-3)
**And** `user_id` is absent from the payload (AD-15)
**And** the shape comes from a `TodoRead` `response_model` declared in `schemas.py`, the sole contract authority (AD-2).

**Given** the client needs the todo type
**When** I inspect frontend source
**Then** `frontend/src/api/types.ts` is the only file declaring an API payload type, hand-mirroring `schemas.py` (AD-2)
**And** `api/client.ts` is the only file issuing a request, to the relative path `/api/todos` (AD-1, AD-5).

**Given** the app is opening and the fetch has not resolved
**When** the board first renders
**Then** a loading indicator is shown, never a blank page (FR-1, UX-DR6).

**Given** the fetch resolves with todos
**When** the board renders
**Then** `useTodos.ts` exposes the list already partitioned into `active` and `completed`, and no component re-filters or re-sorts (AD-6)
**And** active todos appear under the `TODO` label and completed ones under `DONE` (UX-DR2)
**And** each row shows checkbox · description · delete `×` with a 1px border divider (UX-DR4)
**And** completed rows render with strikethrough and the `text-done` token, so completion is distinguishable without color alone (FR-2, UX-DR4, UX-DR8)
**And** each row's checkbox reflects completion state to assistive technology with an accessible name (FR-2, UX-DR8).

**Given** the board is rendered
**When** I inspect the components
**Then** `TodoColumn.tsx` and `TodoRow.tsx` are presentational, receive todos and callbacks as props, hold no state, and issue no `fetch` (AD-1, AD-6)
**And** all styling references `var(--token)` values only (UX-DR1, UX-DR10).

**Given** a viewport at or above 640px
**When** the board renders
**Then** TODO and DONE are two equal side-by-side columns, TODO left (UX-DR9)
**And** below 640px they stack vertically with TODO first and reduced padding, remaining readable down to 320px (UX-DR9, NFR-8).

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | none | Listing has no branching rule that integration does not already cover; AD-11 forbids padding this layer. |
| Integration · backend | `GET /api/todos` populated | `200` with a bare array ordered `createdAt` descending, against a real temp SQLite file. |
| Integration · backend | Payload shape | Keys are camelCase `{id, description, completed, createdAt}` and `userId` is absent (AD-3, AD-15). |
| Integration · frontend | `useTodos` partition | Hook returns loading, then `active` / `completed` already partitioned (AD-6). |
| Integration · frontend | Loading render | Board shows a loading indicator before the fetch resolves, never a blank page (FR-1). |
| Integration · frontend | Completed row | Renders with strikethrough and the checked accessible state (FR-2). |
| Integration · frontend | Presentational components | Components consume pre-partitioned props and never re-filter or re-sort (AD-6). |
| E2E | `view-board.spec.ts` | Seed two active and one completed todo via the API; TODO shows two rows, DONE shows one with strikethrough, in `createdAt`-descending order. Spec resets its own rows and depends on no other spec (AD-11). |
| Ad-hoc | Breakpoint sweep | Resize a real browser through 640px and down to 320px: columns stack with TODO first, nothing clips or overflows. |
| Agentic · performance | List latency and render | p95 `GET /api/todos` under 500ms on localhost with a realistic row count; time to first meaningful render recorded (NFR-1). |
| Agentic · coverage | Per-file numbers | Both gates ≥70%; report the specific numbers for `useTodos.ts` and `repository.py`. |
| Agentic · accessibility | Populated board | axe-core clean; completion conveyed by strikethrough plus checkbox state plus column placement, not color alone; Tab order through list controls sensible and every control named (UX-DR8, NFR-5). |
| Agentic · security | Injection surface | A description containing `<script>` and HTML entities renders as literal text via React escaping only; no `dangerouslySetInnerHTML`; the list query uses SQLModel expressions with no string concatenation (AD-16). |
| Agentic · functional (Chrome MCP) | Board in real Chrome | Both columns, correct ordering, strikethrough on the completed row, zero console errors, and only relative `/api/*` requests on the wire (AD-5). |

Report → `/qa/story-1.2.md`

---

### Story 1.3: Add a Todo

As a user,
I want to type a task and press Enter to see it appear instantly at the top of TODO,
So that I can capture something before I forget it, with no friction.

**Acceptance Criteria:**

**Given** a valid description
**When** I `POST /api/todos` with body `{"description": "..."}`
**Then** I receive `201` and the created todo with a server-generated UUIDv4 `id` and server-set `createdAt` (AD-7, FR-7)
**And** the description is trimmed and constrained to 1–200 characters by `schemas.py` (AD-10)
**And** an empty, whitespace-only, or over-200-character description is rejected with `400 {"error": "VALIDATION_ERROR", "message": "..."}` regardless of client behaviour (AD-4, AD-10, NFR-6)
**And** FastAPI's `RequestValidationError` is remapped from 422 to 400 `VALIDATION_ERROR` by a handler in `main.py`, never constructed inline in the route (AD-4)
**And** the new todo is scoped through the single `current_scope` dependency (AD-15).

**Given** the add bar
**When** the board renders
**Then** a `+` accent icon button sits left of a bottom-bordered text input with no placeholder text, and the input is focused on load (UX-DR3, UX-DR7)
**And** the bar's underline turns accent on `:focus-within` (UX-DR3)
**And** the `+` control has the accessible name `Add todo` and a 32px tap target (UX-DR7, UX-DR8).

**Given** I have typed a valid description
**When** I press Enter or click `+`
**Then** the todo appears immediately at the **top** of the TODO column before server confirmation, rendered under a client-only temp key (FR-3, FR-4, AD-7)
**And** the row's controls are disabled while it carries a temp key (AD-7)
**And** the temp key is never sent to the API
**And** on confirmation the server row replaces the optimistic row with no duplicate (AD-7)
**And** the input clears on success (FR-3).

**Given** an empty or whitespace-only input, or input exceeding 200 characters
**When** I submit
**Then** submission is rejected before any network call, silently — no validation paragraph, no error copy (FR-3, UX-DR7)
**And** the client's length bound reads from one exported constant in `api/types.ts`, and no other literal `200` appears in validation code on either side (AD-10).

**Given** the create request fails
**When** the failure arrives
**Then** only the affected optimistic todo is reverted — never a whole-list snapshot restore (AD-6)
**And** a recoverable error message is surfaced (NFR-2)
**And** the text I typed remains in the input for retry (FR-4, UX-DR6).

**Given** the mutation flow
**When** I inspect frontend source
**Then** `useTodos.ts` is the only holder of todo state and the only caller of `api/client.ts`, and `AddBar.tsx` holds nothing but its local input text (AD-6, AD-1).

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | Description normalization | Trim-then-validate boundary cases at 0, 1, 200, and 201 characters — a genuine branch worth isolating (AD-10, AD-11). |
| Integration · backend | `POST /api/todos` success | `201` with a server-generated UUIDv4 `id` and server-set `createdAt` (AD-7). |
| Integration · backend | Validation rejections | Empty, whitespace-only, and 201-character descriptions each return `400 VALIDATION_ERROR` in the one envelope (AD-4, AD-10). |
| Integration · backend | Malformed body | Returns `400`, not FastAPI's default `422` (AD-4). |
| Integration · backend | Round-trip | The created row is retrievable at the head of `GET /api/todos`. |
| Integration · frontend | Both submit paths | Enter and `+` click each create exactly one todo. |
| Integration · frontend | Optimistic insert | Row appears at the top with controls disabled while it carries a temp key (AD-7). |
| Integration · frontend | Confirmation swap | The server row replaces the optimistic row with no duplicate (AD-7). |
| Integration · frontend | Client-side rejection | Empty and over-length input produce no `api/client` call at all (FR-3). |
| Integration · frontend | Create rollback | On stubbed failure only that row is reverted, an error is surfaced, and the input text is preserved (FR-4, AD-6). |
| E2E | `create-todo.spec.ts` | Type a description, press Enter, row appears at the top of TODO; reload and it persisted. Spec deletes its own row via the API. |
| Ad-hoc | Over-length paste | Pasting a 250-character string is silently rejected with no layout shift. |
| Ad-hoc | Focus ring | The accent focus-visible ring is visible on `+` when tabbing (UX-DR8). |
| Agentic · performance | Optimistic latency | The optimistic row is on screen within 100ms of submit; p95 `POST /api/todos` under 500ms on localhost (NFR-1). |
| Agentic · coverage | Rollback branches | Both gates ≥70%; every optimistic-rollback branch in `useTodos.ts` exercised, with any uncovered lines listed explicitly. |
| Agentic · accessibility | Add bar | axe-core clean with the add bar focused and after submit; `Add todo` accessible name present; silent rejection does not leave a screen-reader user without a feedback path. |
| Agentic · security | Stored XSS and bypass | `<img src=x onerror=alert(1)>` is stored and rendered as literal text; the server rejects over-length input when the API is called directly, bypassing the client check; the 400 body carries no stack trace, SQL, or request echo (AD-4, AD-16). |
| Agentic · functional (Chrome MCP) | Sequential adds | In real Chrome, three adds each land at the top in reverse-chronological order, the input clears each time, console and network log stay clean. |

Report → `/qa/story-1.3.md`

---

### Story 1.4: Complete and Delete a Todo

As a user,
I want to check a todo off so it moves to DONE, uncheck it to bring it back, and delete one permanently,
So that my board reflects the work I have actually finished and drops what no longer matters.

**Acceptance Criteria:**

**Given** an existing todo
**When** I `PATCH /api/todos/{id}` with body `{"completed": true}`
**Then** I receive `200` and the updated todo (FR-5, FR-7)
**And** `completed` is the only field the endpoint accepts in v1 — description remains immutable (FR-7)
**And** an unknown id returns `404 {"error": "NOT_FOUND", "message": "..."}` in the one envelope (AD-4)
**And** the update and its query live entirely in `repository.py` (AD-9).

**Given** an existing todo
**When** I `DELETE /api/todos/{id}`
**Then** I receive `204` with no body and the row is hard-deleted (FR-6, FR-7)
**And** an unknown id returns `404 NOT_FOUND` (AD-4)
**And** a subsequent `GET /api/todos` does not include it.

**Given** an active todo in the TODO column
**When** I click its checkbox
**Then** the row moves immediately to the DONE column with strikethrough and the `text-done` token, before server confirmation (FR-5, UX-DR4)
**And** unchecking a completed todo moves it back to TODO (UX-DR4)
**And** the checkbox is keyboard-operable and its state is exposed to assistive technology (NFR-5, UX-DR8)
**And** the change persists across a refresh and a new session (FR-5).

**Given** a todo in either column
**When** I click its `×` delete control
**Then** the row disappears from the board immediately, before server confirmation (FR-6)
**And** the control has the accessible name `Delete`, renders in the `control` gray token at rest and `control-hover` on hover, and is never accent green or red (UX-DR5, UX-DR7)
**And** it is visually and semantically unambiguous against the completion checkbox (FR-6)
**And** the deleted todo does not reappear after a refresh (FR-6)
**And** there is no undo affordance in v1.

**Given** a toggle or delete request fails
**When** the failure arrives
**Then** only the affected todo is reverted to its exact pre-call value — the toggled row returns to its prior column, the deleted row reappears in place — with no whole-list snapshot restore, so a concurrent mutation is never silently undone (AD-6)
**And** a recoverable error message is surfaced (NFR-2).

**Given** both mutations
**When** I inspect frontend source
**Then** they follow the single AD-6 sequence (optimistic local apply → API call → per-todo revert on failure) inside `useTodos.ts`, and `TodoRow.tsx` only invokes callbacks passed as props (AD-1, AD-6).

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | none | Toggle is a field write with no branching domain rule; integration covers it (AD-11). |
| Integration · backend | `PATCH` both directions | Toggles `completed` true and false, returning the updated resource (FR-5). |
| Integration · backend | `PATCH` unknown id | Returns `404 NOT_FOUND` in the one envelope (AD-4). |
| Integration · backend | `PATCH` description immutable | An attempt to change `description` does not change it (FR-7). |
| Integration · backend | `DELETE` success | Returns `204` and the row is absent from a subsequent list (FR-6). |
| Integration · backend | `DELETE` unknown id | Returns `404 NOT_FOUND` (AD-4). |
| Integration · frontend | Optimistic toggle | Checkbox click moves the row between columns immediately and calls the client exactly once. |
| Integration · frontend | Optimistic delete | `×` removes the row immediately. |
| Integration · frontend | Toggle rollback | On stubbed failure the row returns to its original column. |
| Integration · frontend | Delete rollback | On stubbed failure the row reappears in place. |
| Integration · frontend | Anti-snapshot guard | Both rollbacks leave a second, concurrently-mutated todo untouched — the assertion that catches a whole-list snapshot-restore implementation (AD-6). |
| E2E | `complete-and-delete.spec.ts` | Seed a todo via the API; check it → moves to DONE; uncheck → returns to TODO; check again, delete, reload, gone. Spec resets its own rows. |
| Ad-hoc | Touch targets | On a touch viewport the checkbox and `×` are individually tappable without mis-hits, and `×` reads as neutral rather than destructive-red (UX-DR5). |
| Agentic · performance | Mutation latency | Both mutations reflect in the UI within 100ms; p95 `PATCH` and `DELETE` under 500ms on localhost (NFR-1). |
| Agentic · coverage | Rollback branches | Both gates ≥70%; every toggle and delete rollback branch covered, including the concurrent-mutation case. |
| Agentic · accessibility | Post-mutation states | axe-core clean after a toggle and after a delete; checkbox role and state announced; `Delete` accessible name present; both controls keyboard-operable; focus is neither lost nor trapped when a row leaves the DOM. |
| Agentic · security | Mass assignment and ids | `PATCH` with an unexpected extra field or mismatched type is rejected without mass-assignment; id values are never interpolated into SQL; 404 bodies reveal no path, SQL, or stack trace (AD-4, AD-16). |
| Agentic · functional (Chrome MCP) | Toggle and delete in real Chrome | Toggle a row twice then delete it, refreshing between steps to confirm persistence each time, with a clean console and network log. |

Report → `/qa/story-1.4.md`

---

### Story 1.5: Intentional Empty State

As a first-time user,
I want a board with no todos to look deliberate rather than broken,
So that I trust the app and know exactly where to start.

**Acceptance Criteria:**

**Given** no todos exist
**When** `GET /api/todos` is called
**Then** it returns `200` with a bare empty array — never 404 and never an error (FR-1, AD-4).

**Given** the fetch has resolved with no todos
**When** the board renders
**Then** both TODO and DONE columns are present with their section labels and are visibly empty (UX-DR6)
**And** no empty-state copy, illustration, or onboarding text is rendered — the focused input is the only affordance (UX-DR6, UX-DR7)
**And** the add bar is focused and immediately usable (UX-DR3)
**And** the loading indicator is gone and no error state is shown (FR-1).

**Given** an empty board
**When** I add my first todo
**Then** it appears at the top of TODO and the DONE column remains empty without shifting the layout (FR-3, UX-DR9).

**Given** I delete the last remaining todo
**When** the deletion confirms
**Then** the board returns to the same empty presentation as a cold empty open, with no residual error or loading state (FR-6, UX-DR6).

**Given** an empty board at any supported viewport
**When** it renders
**Then** the two-column structure holds above 640px and stacks below it, with no collapsed or zero-height column (UX-DR9, NFR-8).

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | none | No isolable rule here, only composed presentation (AD-11). |
| Integration · backend | `GET /api/todos` empty | Returns `200` and `[]` — never 404, never an error. The empty-state contract, distinct from story 1.2's populated case (FR-1). |
| Integration · frontend | Empty board render | With the stubbed client returning `[]`, both column labels render, no empty-state copy string is in the DOM, the add bar holds focus, and neither the loading indicator nor an error banner is shown (UX-DR6). |
| Integration · frontend | Return to empty | Deleting the last todo returns the board to that same rendering, with no residual error or loading state (FR-6). |
| E2E | `empty-state.spec.ts` | Ensure no todos exist via the API; both labels present with zero rows and no empty-state copy; add one todo and the board transitions cleanly to populated. |
| Ad-hoc | Genuine cold open | On an empty database the screen reads as an intentional surface rather than a failed load, and the caret is already in the input. |
| Agentic · performance | Empty cold open | Time to interactive recorded; no layout shift when the first row is added (NFR-1). |
| Agentic · coverage | Empty branch | Both gates ≥70%; the empty branch of board rendering is covered. |
| Agentic · accessibility | Empty board | axe-core clean; empty columns are not announced as broken or meaningless structure; section labels reachable; initial focus placement sensible for a screen-reader user (NFR-5, UX-DR8). |
| Agentic · security | Empty response | Leaks no schema detail, row-count metadata, or internal identifier (AD-4). |
| Agentic · functional (Chrome MCP) | Empty board in real Chrome | Both labels render on the black canvas, the input is focused, zero console errors, no failed requests. |

Report → `/qa/story-1.5.md`

---

### Story 1.6: Error Handling and Retry

As a user,
I want a clear, human-readable message and a retry when something goes wrong,
So that I always know whether my action took effect and never face a blank broken screen.

**Acceptance Criteria:**

**Given** any non-2xx outcome on the API
**When** the response is produced
**Then** its body is exactly `{"error": "<CODE>", "message": "<user-facing text>"}` with `error` in `VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR` (AD-4)
**And** every such body comes from an exception handler registered in `main.py`, keyed to the `AppError` hierarchy raised by services — no route handler constructs an error response inline (AD-4)
**And** an unhandled exception becomes `500 INTERNAL_ERROR` with a generic message, the detail logged to stdout with the exception and never returned (AD-4, AD-16)
**And** no response body contains a stack trace, SQL, file path, or echo of the request body (AD-16).

**Given** the initial list fetch fails
**When** the board renders
**Then** an error state shows the server's `message` verbatim alongside a retry action, and the list area is not blank or broken (FR-1, UX-DR6)
**And** clicking retry re-issues the fetch and, on success, renders the board normally with the error cleared (FR-1).

**Given** the network fails outright with no response at all
**When** the client handles it
**Then** it uses its single local fallback string — the only user-facing copy the client authors — and never invents per-code messages of its own (AD-4).

**Given** a mutation fails — create, toggle, or delete
**When** the error surfaces
**Then** the affected todo is reverted per AD-6 and a recoverable error is shown without discarding the rest of the board (NFR-2)
**And** on a failed create the typed text is preserved (FR-4)
**And** the error is dismissible or self-clearing on the next successful action, never permanently stuck on screen.

**Given** the error banner
**When** it appears
**Then** it uses only `DESIGN.md` tokens with no red delete-style treatment or new accent hue (UX-DR1, UX-DR10)
**And** it is announced to assistive technology and reachable by keyboard, with retry operable by Enter (NFR-5, UX-DR8)
**And** its copy is a single short human-readable line, not a validation paragraph (UX-DR7).

**Given** all three error categories named by FR-1 — unreachable API, server error (500), validation error (400)
**When** each occurs
**Then** each produces a distinguishable, human-readable user-facing outcome and never a silent failure (FR-1, NFR-2).

**Tests:**

| Layer | Test | Asserts |
|---|---|---|
| Unit | `AppError` mapping | The `AppError` → HTTP status and code table, asserted exhaustively over the hierarchy — a real branching rule (AD-4, AD-11). |
| Integration · backend | `400 VALIDATION_ERROR` | Produced through a real invalid create, body matching the envelope exactly. |
| Integration · backend | `404 NOT_FOUND` | Produced through a real unknown id on both `PATCH` and `DELETE`. |
| Integration · backend | `500 INTERNAL_ERROR` | Produced by a forced service failure; body carries a generic message while the detail appears in the log (AD-4, AD-16). |
| Integration · backend | 422 remap | A `RequestValidationError` surfaces as `400`, never `422` (AD-4). |
| Integration · frontend | Failed initial fetch | Renders the server `message` verbatim alongside a retry control, list area not blank (FR-1). |
| Integration · frontend | Retry recovery | Retry re-fetches and clears the error on success. |
| Integration · frontend | Network fallback | A total network failure renders the single local fallback string — the only copy the client authors (AD-4). |
| Integration · frontend | Mutation errors | Failed create, toggle, and delete each surface a recoverable error while reverting only the affected todo (AD-6, NFR-2). |
| E2E | `error-handling.spec.ts` | Intercept `/api/todos` to fail on load: error message and retry visible, list area not blank; let retry succeed and the board renders. Spec touches no persisted rows. |
| Ad-hoc | Backend down | Stop the backend with the app open and attempt an add: typed text survives, the message is comprehensible to a non-developer, and restarting plus retry recovers without a reload. |
| Agentic · performance | Error latency | The error surfaces within 100ms of the failed response; retry does not stack duplicate in-flight requests (NFR-1). |
| Agentic · coverage | Error paths | Both gates ≥70%; every `AppError` subclass and every client error path, including the network-failure fallback, is covered. |
| Agentic · accessibility | Error state | axe-core clean; the message is announced to a screen reader, focus moves or is otherwise reachable, retry is Enter-operable, and the state is not conveyed by color alone (NFR-5). |
| Agentic · security | Leakage under failure | A forced 500 body has no stack trace, SQL, file path, or request echo; the log entry contains the exception but no request body; no error path leaks a database file path or dependency version (AD-4, AD-16). |
| Agentic · functional (Chrome MCP) | Error and recovery in real Chrome | Block `/api/*`, load the app: error and retry render on the black canvas with the list area intact; unblock, click retry, normal rendering with a clean console. |

Report → `/qa/story-1.6.md`

---

### Epic 1 Coverage Verification

| Requirement | Covered by |
|---|---|
| FR-1 | 1.2 (loading, populated), 1.5 (empty), 1.6 (error + retry) |
| FR-2 | 1.2 |
| FR-3 | 1.3 (1.5 verifies first-add transition) |
| FR-4 | 1.3, 1.6 |
| FR-5 | 1.4 |
| FR-6 | 1.4, 1.5 (last-delete returns to empty) |
| FR-7 | 1.1 (substrate, health), 1.2 (`GET`), 1.3 (`POST`), 1.4 (`PATCH`, `DELETE`), 1.6 (error envelope) |
| NFR-1 performance | Agentic performance check, every story |
| NFR-2 reliability | 1.3, 1.4, 1.6 |
| NFR-3 maintainability | 1.1 (AD-13 Makefile, AD-1 layering) |
| NFR-4 local deployment | 1.1 (AD-14 profiles) |
| NFR-5 accessibility | 1.2, 1.4, 1.5, 1.6 + agentic accessibility check, every story |
| NFR-6 security | 1.3 (server-authoritative validation) + agentic security check, every story |
| NFR-7 extensibility | 1.1 (AD-15 `user_id`, `current_scope`) |
| NFR-8 responsive | 1.2, 1.5 |
| UX-DR1 tokens | 1.1 |
| UX-DR2 single surface | 1.2 |
| UX-DR3 add bar | 1.3, 1.5 |
| UX-DR4 todo row | 1.2, 1.4 |
| UX-DR5 delete control | 1.4 |
| UX-DR6 state treatments | 1.2, 1.5, 1.6 |
| UX-DR7 microcopy | 1.3, 1.4, 1.6 |
| UX-DR8 accessibility floor | 1.2, 1.3, 1.4, 1.6 |
| UX-DR9 responsive layout | 1.2, 1.5 |
| UX-DR10 flat visual language | 1.1, 1.6 |

Five Playwright journeys total — `view-board`, `create-todo`, `complete-and-delete`, `empty-state`, `error-handling` — matching AD-11's named E2E scope. Story 1.1 carries no journey; it creates and proves the harness.
