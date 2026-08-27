# Reconcile — PRD

Source: `../prds/prd-bmad-todo-application-typescript-2026-08-24/prd.md`

## Adopted from PRD

| PRD area | UX treatment |
|---|---|
| UJ-1 Alex backlog dump | Flow 1 — add via Enter/+, new item at top of TODO |
| UJ-2 Sam refresh persistence | Flow 2 + state patterns — loading/error/empty as first-class |
| FR-3 Add with description | Add bar, 200-char cap, Enter/+ submit, whitespace rejected |
| FR-4 Optimistic create rollback | State pattern — preserve input on failed create |
| FR-5 Toggle completion | Checkbox moves row TODO ↔ DONE |
| FR-6 Delete | × per row, hard delete, optimistic rollback |
| FR-1 Display on load | Single todo board surface, loading/error states |
| Accessibility floor | Checkbox labels, focus rings, strikethrough + column for completion |
| Responsive 320px+ | Mobile stack, desktop two-column |

## Overrides (UX wins)

| PRD assumption | UX decision | Rationale |
|---|---|---|
| §3 — completed todos in same list, de-emphasized | Two columns: TODO \| DONE | Builder preference; physical separation of open vs done work |
| §3 glossary "Todo List" as single ordered collection | Two lists rendered from one API collection, split by completion status | Same data model; different presentation |
| PRD uses "Todo" / "Completed Todo" vocabulary | UI labels **TODO** / **DONE** | Builder-specified minimal chrome |

## Dropped / deferred (not in UX scope)

| PRD item | Status |
|---|---|
| Created At visible on each row | Not shown in v1 UX — PRD FR-1 mentions it; builder chose minimal rows. Implementation may still expose via API; display deferred. |
| Empty state message (FR-1) | UX uses silent empty columns — input is the affordance |
| Inline description edit | Deferred to v2 per PRD |

## Open for implementation

- Map API single-list model to two-column UI client-side (filter by completion status).
- Optimistic UI patterns from PRD apply to column moves and deletes.
- PRD FR-1 Created At display — confirm with builder at build time if needed.
