---
title: Todo App
status: final
created: 2026-08-24
updated: 2026-08-24
---

# PRD: Todo App

## 0. Document Purpose

This PRD defines requirements for a minimal full-stack Todo application built as a **learning project**. It is for the builder and anyone implementing from this spec. Structured around Glossary-anchored vocabulary, user journeys with named protagonists, and globally numbered functional requirements (FR-N) grouped by feature. Remaining assumptions are tagged `[ASSUMPTION]` and indexed in §10. Technical stack and architecture choices belong in `addendum.md`, not here.

## 1. Vision

Users need a dependable place to capture and track personal tasks without learning a new system. This product is a deliberately minimal Todo application: open it, see your tasks, add one, mark it done, delete it — no accounts, no setup, no feature tour.

The application pairs a responsive web frontend with a small persistence API. Interactions feel instant; completed tasks are visually obvious; empty, loading, and error states feel intentional rather than broken. The scope is intentionally narrow so the first version ships as a complete, usable product — not a prototype — while leaving a clean path to authentication, multi-user support, and richer task metadata in future iterations.

Success means a first-time user completes every core action without documentation, data survives refresh and return visits, and the codebase remains easy for the next developer to understand and extend.

## 2. Target User

### 2.1 Jobs To Be Done

- **Functional:** Capture tasks quickly before they are forgotten; see what is still open at a glance; mark work done and remove tasks that are no longer relevant.
- **Emotional:** Feel in control of a personal workload without the anxiety of a complex productivity suite.
- **Contextual:** Use the same list on phone and desktop during a normal day — no sync account required in v1 `[ASSUMPTION: single-device or shared-browser use is acceptable in v1; no cross-device sync]`.

### 2.2 Non-Users (v1)

- Teams needing shared or assigned tasks.
- Users requiring reminders, due dates, priorities, or recurring tasks.
- Anyone expecting account-based identity, login, or data isolation between users on the same deployment.

### 2.3 Key User Journeys

- **UJ-1. Alex opens the app and clears a mental backlog.**
  - **Persona + context:** Alex, a developer between meetings, needs to dump three errands before switching context.
  - **Entry state:** Unauthenticated. Opens the app in a mobile browser bookmark — no prior session setup.
  - **Path:** Landing view shows the Todo List (empty or populated). Alex taps the add control, types each task, submits with Enter. Each new Todo appears at the **top** of the list. Alex marks two items complete via checkbox/tap.
  - **Climax:** All three tasks are visible; completed ones show strikethrough and reduced emphasis. Alex closes the tab confident nothing was lost.
  - **Resolution:** List persists on next open. Active and completed Todos remain distinguishable.
  - **Edge case:** Network fails mid-add — optimistic UI rolls back the failed item and shows a recoverable error message without clearing the input text.

- **UJ-2. Sam returns after a browser refresh.**
  - **Persona + context:** Sam uses the app on a laptop during the workday.
  - **Entry state:** Same browser, new tab session. No login.
  - **Path:** App loads with a brief loading state, then renders the full Todo List from the API. Sam completes one task and deletes another.
  - **Climax:** Actions reflect immediately in the UI; server state matches after confirmation.
  - **Resolution:** Sam refreshes the page — list matches last actions exactly.
  - **Edge case:** API unreachable on load — error state explains the problem and offers retry without a blank broken screen.

## 3. Glossary

- **Todo** — A single personal task record. Has a **Description** (short text, max 200 characters), **Completion Status** (active or completed), and **Created At** (timestamp set at creation, immutable in v1). Belongs to the global **Todo List** in v1 `[ASSUMPTION: single global list; no projects or categories]`.
- **Todo List** — The ordered collection of all Todos shown on the primary screen. Includes both active and completed Todos in v1 `[ASSUMPTION: completed Todos remain visible in the same list, visually de-emphasized]`.
- **Active Todo** — A Todo whose Completion Status is not completed.
- **Completed Todo** — A Todo marked complete; visually distinct (strikethrough, reduced opacity, or equivalent).
- **Client** — The responsive web frontend the user interacts with.
- **API** — The backend service exposing CRUD endpoints for Todos and persisting them durably.

## 4. Features

### 4.1 View Todo List

**Description:** On open, the Client fetches and displays all Todos without onboarding or empty chrome blocking the list area. Realizes UJ-1, UJ-2. Loading, empty, and error states are first-class.

**Functional Requirements:**

#### FR-1: Display Todo List on load

The user can see all Todos immediately after the app finishes its initial load. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Given persisted Todos exist, the primary view renders every Todo with Description, Completion Status, and Created At (locale-aware short date/time, e.g. "Aug 24, 2:30 PM").
- Given no Todos exist, an **Empty State** appears with a short message and a clear path to add the first Todo.
- While the initial fetch is in progress, a **Loading State** is shown — not a blank page.
- If the initial fetch fails, an **Error State** is shown with a human-readable message and a retry action. Minimum categories: unreachable API, server error (500), validation error (400).

#### FR-2: Distinguish active and completed Todos

The user can tell at a glance which Todos are active vs completed. Realizes UJ-1.

**Consequences (testable):**
- Completed Todos use strikethrough and/or reduced visual emphasis distinct from active Todos.
- Completion Status is available to assistive technology (e.g., checkbox or equivalent with accessible name).

**Feature-specific NFRs:**
- List layout remains readable on viewports from 320px width upward and on desktop widths.

---

### 4.2 Create Todo

**Description:** The user adds a new Todo with minimal friction — type and submit. Realizes UJ-1.

**Functional Requirements:**

#### FR-3: Add Todo with description

The user can create a Todo by entering a short text Description and submitting. Realizes UJ-1.

**Consequences (testable):**
- Submit via primary button and via Enter key from the input field.
- Empty or whitespace-only Descriptions are rejected client-side with inline feedback; no API call is made.
- Description length is capped at **200 characters**; excess input is rejected client-side with inline feedback.
- On success, the new Todo appears at the **top** of the Todo List with Completion Status active and Created At set to creation time.
- The add input clears after successful creation.

#### FR-4: Optimistic create with rollback

The Client reflects a new Todo immediately before server confirmation. Realizes UJ-1 edge case.

**Consequences (testable):**
- On API failure after optimistic insert, the Todo is removed from the list and the user sees an error message; entered text is preserved in the input for retry.

---

### 4.3 Complete and Uncomplete Todo

**Description:** The user toggles Completion Status with a single action. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-5: Toggle completion status

The user can mark an active Todo completed and mark a completed Todo active again. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Toggle is a single click/tap on a dedicated control per Todo.
- Visual distinction updates immediately (optimistic UI with rollback on failure per FR-4 pattern).
- Completion change persists across refresh and new sessions.

---

### 4.4 Delete Todo

**Description:** The user removes Todos that are no longer needed. Realizes UJ-2.

**Functional Requirements:**

#### FR-6: Delete Todo

The user can permanently delete any Todo. Realizes UJ-2.

**Consequences (testable):**
- Delete is reachable per Todo via an explicit control (not ambiguous with complete toggle).
- Deleted Todos disappear from the list immediately (optimistic UI with rollback on failure).
- Deleted Todos do not reappear after refresh.

**Out of Scope:**
- Undo/snackbar after delete in v1 (hard delete; acceptable for learning scope).

---

### 4.5 Backend Persistence API

**Description:** The API durably stores Todos and supports the Client's CRUD operations. Realizes UJ-2. Contract shapes live in `addendum.md`; this section states behavioral requirements only.

**Functional Requirements:**

#### FR-7: Persist Todos via CRUD API

The API supports create, read (list + single), update (completion toggle at minimum), and delete of Todos. Realizes UJ-2.

**Consequences (testable):**
- All Todos survive API process restart and redeploy (durable storage, not in-memory only).
- List endpoint returns all Todos for the single implicit user/context in v1.
- Update endpoint supports changing Completion Status; Description is immutable after creation in v1 `[ASSUMPTION: no inline edit of Description in v1]`.
- API returns consistent error responses (`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`) per `addendum.md`; Client maps these to user-facing messages.
- Rejects Description over 200 characters or empty/whitespace with `VALIDATION_ERROR`.
- Concurrent requests from the same Client do not corrupt stored state (last-write-wins on Completion Status is acceptable in v1).

**Notes:**
- `[NOTE FOR PM]` Authn/authz hooks (user ID on Todo, protected routes) should be structurally reserved without implementing login in v1 — capture in addendum during architecture.

---

## 5. Non-Goals (Explicit)

- User accounts, login, registration, or password recovery.
- Multi-user data isolation or shared lists.
- Task prioritization, ordering drag-and-drop, tags, projects, or folders.
- Due dates, reminders, or notifications.
- Collaboration, comments, or assignment.
- Offline-first sync or native mobile apps.
- Analytics dashboards or admin consoles.

## 6. MVP Scope

### 6.1 In Scope

- Responsive web Client (desktop + mobile browsers).
- Todo List view with empty, loading, and error states.
- Create, complete/uncomplete, delete Todos.
- Optimistic UI with failure rollback for all mutating actions.
- RESTful (or equivalent) CRUD API with durable persistence.
- **Local deployment** — runs on developer machine (no cloud hosting requirement for v1).
- Basic client- and server-side validation and error handling.
- Architecture that does not foreclose future auth and multi-user support.

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| Authentication / multi-user | Explicit v1 exclusion; deferred to v2 |
| Edit Todo Description after creation | Narrow v1 scope; deferred to v2 |
| Delete undo | Polish item; not required for learning v1 |
| Cross-device sync | Requires accounts or sync layer |
| PWA install / push notifications | Not needed for core value |
| Sort/filter controls | Minimal list is sufficient for v1 |

## 7. Success Metrics

**Primary**

- **SM-1: Core task completion without guidance** — A new user adds, completes, and deletes a Todo within 2 minutes with no help doc. Validates FR-3, FR-5, FR-6.
- **SM-2: Session durability** — 100% of successfully committed Todos remain after browser refresh and API restart under normal operation. Validates FR-7, FR-1.

**Secondary**

- **SM-3: Perceived responsiveness** — Mutating actions reflect in UI within 100ms locally (optimistic); p95 API round-trip under 500ms on localhost. Validates FR-4, FR-5, FR-6.

**Counter-metrics (do not optimize)**

- **SM-C1: Feature count** — Do not add capabilities beyond MVP to inflate completeness scores. Counterbalances scope creep.

## 8. Cross-Cutting NFRs

- **Performance:** Initial list render within SM-3 bounds (optimistic mutations ≤100ms local; p95 API ≤500ms on localhost).
- **Reliability:** No silent data loss on API errors; user always knows if an action failed.
- **Maintainability:** Clear separation between Client and API; minimal dependencies; runs locally with a simple start command (details in addendum).
- **Deployment:** Local-only for v1 — file-based or local DB persistence; no cloud hosting requirement.
- **Accessibility:** Interactive controls keyboard-operable; completion state perceivable without color alone; reasonable focus order on add + list controls `[ASSUMPTION: WCAG 2.1 AA is a stretch goal, not a gate, for learning scope]`.
- **Security (v1):** No auth does not mean no validation — enforce 200-character Description limit and basic content validation server-side; no secrets in Client bundle.
- **Extensibility:** Todo entity and API design should allow a future `userId` (or equivalent) field without migration pain.

## 9. Open Questions

*(None — inline Description edit deferred to v2; list sort order defined in `addendum.md`.)*

## 10. Assumptions Index

- §2.1 — Single-device / no cross-device sync in v1.
- §3 — Single global Todo List; no categories/projects.
- §3 — Completed Todos stay visible in the same list, de-emphasized.
- §4.5 FR-7 — Description immutable after creation in v1 (inline edit deferred to v2).
- §8 — WCAG 2.1 AA as stretch goal, not release gate.
