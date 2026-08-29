# Epic 1 Context: A Working Personal Todo Board

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the entire v1 product as one epic: a user opens the app locally, sees their persisted todos split into TODO and DONE columns, adds a todo, completes or uncompletes it, deletes it, and always understands what the app is doing when the board is loading, empty, or the API has failed. Story 1.1 lays a walking skeleton (two services, persistence, health endpoint, one entrypoint, green CI); stories 1.2–1.6 are vertical full-stack slices that each add one endpoint plus its UI. The whole epic is a single epic because every slice touches the same core files (`useTodos.ts`, `api/client.ts`, `routers/todos.py`, `repository.py`) and the architecture and UX are fully pre-designed, so no direction change is expected between slices.

## Stories

- Story 1.1: Walking Skeleton — Runnable, Testable, Deployable Shell
- Story 1.2: View the Todo Board
- Story 1.3: Add a Todo
- Story 1.4: Complete and Delete a Todo
- Story 1.5: Intentional Empty State
- Story 1.6: Error Handling and Retry

## Requirements & Constraints

- **Product surface:** one screen, no routes, no auth, no onboarding, no settings. A single global todo list, ordered newest-first, with active and completed todos separated into two columns.
- **Todo entity:** short description (trimmed, 1–200 characters), completion status, immutable creation timestamp. Description is immutable after creation in v1; completion is the only mutable field.
- **Persistence:** a CRUD API (list, create, update completion, delete) over durable local storage that survives restarts. Local deployment only — no cloud hosting, no cross-device sync.
- **Optimistic interaction:** every mutation reflects in the UI within ~100ms, before server confirmation, and rolls back on failure. p95 API round-trip ≤500ms on localhost.
- **No silent data loss:** the user always learns when an action failed, and a failed create preserves the text they typed.
- **Server-authoritative validation:** length and emptiness rules are enforced server-side regardless of what the client does; the client mirrors the same bound to avoid a pointless round-trip.
- **Accessibility floor:** every interactive control keyboard-operable with an accessible name; completion perceivable without color alone; sensible focus order. WCAG 2.1 AA is a stretch goal, not a gate.
- **Responsive:** readable from 320px through desktop widths.
- **Extensibility:** the entity and API must accept a future per-user scope without a redesign or a schema rebuild.
- **Per-story Definition of Done:** a stacked pull request cut from the previous story's branch and targeting it; `make ci` green (lint, both test suites, coverage gates, E2E); an agentic QA report at `/qa/story-1.<M>.md` covering performance, coverage, accessibility, security, and functional-in-real-Chrome, each with a verdict and evidence; and no architectural drift, with the PR naming the decisions a reviewer should spot-check.

## Technical Decisions

- **Layering (strict, both sides):** `components → hooks/useTodos → api/client` and `routers → services → repository → models`. Imports only flow downward; no sibling imports within a layer.
- **Contract:** the backend schema module is the sole authority for request/response shapes; the client hand-mirrors it in exactly one types file. camelCase on the wire, snake_case in Python, via one shared alias-generator base — no per-field aliases. Success bodies are the bare resource or a bare array; timestamps are UTC ISO 8601 strings; ids are server-generated UUIDv4.
- **Errors:** one envelope `{error, message}` with codes `VALIDATION_ERROR | NOT_FOUND | INTERNAL_ERROR`, produced only by centrally registered exception handlers keyed to an `AppError` hierarchy raised by services. Framework 422s are remapped to 400; unhandled exceptions become a generic 500 with detail logged, never returned. The client renders the server message verbatim and authors exactly one local string, used only when there is no response at all.
- **Client state:** the `useTodos` hook is the only holder of todo state and the only caller of the API client. Every mutation is: apply optimistically → call API → on failure revert **only the affected todo**. Whole-list snapshot-and-restore is forbidden (it would silently undo a concurrent mutation). The hook exposes the list pre-partitioned as `active`/`completed`; no component re-filters or re-sorts. Optimistic rows carry a client-only temp key, never sent to the API, with their controls disabled until confirmed.
- **Transport:** relative `/api/*` requests only — no absolute URL, no API-host env var, no CORS middleware. The edge routes `/api` (dev proxy, nginx in the test profile).
- **Persistence:** all SQL/ORM queries live in the repository module, including the newest-first ordering. One session per request from a single dependency that commits on success and rolls back on failure; repository functions flush and refresh but never commit. Schema is created by ORM metadata on startup — no migration tool, no hand-written DDL; non-additive changes require a database reset noted in the PR.
- **Scope seam:** a nullable user column exists on the model, is absent from every v1 response shape, and handlers take their owner from a single scope dependency so auth arrives by replacing that dependency.
- **Testing layers (fixed, do not pad):** backend integration against a real temp SQLite file covering every endpoint and error code; backend unit only for service rules with real branches; frontend component/hook tests against a stubbed API client covering every rollback path; exactly one Playwright journey per slice against the test compose profile, order-independent and self-resetting through the API, with axe-core accessibility assertions. Only Playwright may start a live server.
- **Tooling and ops:** the root Makefile is the only entrypoint and CI invokes make targets only; each side gates independently at ≥70% line coverage, tool-enforced. One compose file with `dev` and `test` profiles; all backend config read once into a typed settings object with working local defaults; fixed ports (backend 8000, dev server 5173, nginx 8080); one health endpoint used by both the container healthcheck and compose readiness gating.
- **Security baseline:** ORM expressions only (no string-built SQL), React default escaping only, no stack traces/SQL/paths/request echoes in responses or logs, non-root containers, git-ignored `.env` with a placeholder example.
- **Scaffold:** no starter template — the source tree is authored from the architecture's structural seed, and story 1.1 must match it exactly.

## UX & Interaction Patterns

- **Visual system:** black canvas, one green accent, flat — no elevation, shadows, border radius, colored column backgrounds, extra accent hues, or additional heading levels. All design tokens are declared once as CSS custom properties and referenced only via `var(--token)`; no hard-coded hex, no CSS-in-JS, no UI framework.
- **Composition:** two section labels only, TODO and DONE, with an add bar above them. The mockup is the composition reference; the architecture spine wins on conflict.
- **Add bar:** an accent `+` icon button left of a bottom-bordered input with no placeholder; submit via Enter or click; the underline turns accent on focus-within; the input is focused on load; new rows insert at the top of TODO.
- **Todo row:** checkbox · description · delete `×`, separated by 1px dividers. Toggling moves the row between columns; completed labels get strikethrough plus the muted done color. The delete control is neutral gray with a lighter hover — never accent, never red — and there is no undo.
- **State treatments:** a loading indicator on cold open, never a blank page; the empty board shows both labeled columns with zero rows and no empty-state copy or illustration (the focused input is the affordance); the error state shows a short human-readable line plus a retry action without blanking the list area.
- **Microcopy:** `TODO`/`DONE` labels and `Add todo`/`Delete` accessible names only. Invalid input is rejected silently — no validation paragraphs, no onboarding text.
- **Accessibility specifics:** accessible name on every control, checkbox state exposed to assistive tech, completion signalled by strikethrough plus column placement plus checkbox state, accent focus-visible rings, Tab order through the add bar then list controls, 32px tap target on `+`, and focus neither lost nor trapped when a row leaves the DOM.
- **Responsive:** ≥640px two equal columns (TODO left, DONE right); below 640px stacked with TODO first and reduced padding and column gap.

## Cross-Story Dependencies

- Stories are strictly sequential and branches are stacked: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6, each PR targeting the previous story's branch.
- 1.1 is a hard prerequisite for everything: it creates the source tree, persistence, session lifecycle, test fixtures, Playwright harness, Makefile, CI, and the design tokens that all later stories build on.
- 1.2 establishes the API contract, the client type mirror, the state hook and its partitioning, and the presentational components; 1.3 and 1.4 extend those same files rather than adding parallel ones.
- 1.5 depends on the list rendering from 1.2, the create flow from 1.3, and delete from 1.4 (returning to empty after the last deletion).
- 1.6 depends on the mutations from 1.3 and 1.4 existing so their failure paths can be surfaced; the error envelope and the rollback discipline it formalizes are already used by earlier stories, so 1.6 hardens and completes them rather than introducing them.
