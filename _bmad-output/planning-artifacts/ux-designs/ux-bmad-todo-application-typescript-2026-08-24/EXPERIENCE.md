---
name: Todo
status: final
sources:
  - ../prds/prd-bmad-todo-application-typescript-2026-08-24/prd.md
created: 2026-08-24
updated: 2026-08-24
---

# Todo — Experience Spine

> Personal minimal todo app. Responsive web. Paired with `DESIGN.md`. Spine wins on conflict with mocks.

## Foundation

Responsive web (desktop + mobile browsers). No UI system — custom flat layout on `{colors.canvas}`. `DESIGN.md` is the visual identity reference; this spine owns behavior, IA, and interaction. Single surface: no routes, no onboarding, no auth. User lands directly on the todo board.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Todo board | App open (cold) | Add todos, view TODO / DONE columns, complete, delete |

One screen only. No navigation chrome, no tabs, no settings in v1.

→ Composition reference: [`mockups/main.html`](mockups/main.html). Spine wins on conflict.

## Voice and Tone

Microcopy. Brand voice lives in `DESIGN.md`.

| Do | Don't |
|---|---|
| `TODO` / `DONE` as section labels | Full sentences, onboarding copy, empty-state essays |
| `Add todo` / `Delete` as aria labels | Placeholder text in the input field |
| Silent rejection of empty input | Inline validation paragraphs |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Add bar | Top of board | + button left of text input. Submit via Enter or + click. Empty/whitespace rejected silently; input preserved on API failure (per PRD FR-4). New item appears at **top** of TODO column. Input clears on success. |
| Todo row | TODO or DONE column | Checkbox · description · delete (×). Row moves to the other column on checkbox toggle. Unchecking moves back to TODO. |
| Section label | Column header | Only two on screen: TODO (left), DONE (right). |
| Delete control | Per row | Hard delete, no undo in v1. Optimistic removal with rollback on API failure. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold open — loading | Todo board | Show loading indicator; not a blank page (PRD FR-1). |
| Cold open — populated | Todo board | Split todos into TODO (active) and DONE (completed) columns. |
| Cold open — empty | Todo board | Both columns empty. No empty-state copy — input is the affordance. |
| Cold open — error | Todo board | Human-readable error + retry. List area not blank/broken (PRD FR-1). |
| Active todo | TODO column | Full `{colors.text}`, no strikethrough. Checkbox unchecked. |
| Completed todo | DONE column | `{colors.text-done}`, strikethrough. Checkbox checked. |
| Add bar focus | Add bar | Column underline turns `{colors.accent}` (`:focus-within`). |
| Optimistic failure | Any mutation | Roll back UI change; show recoverable error; preserve input text on failed create. |

## Interaction Primitives

- **Enter** or **+ click** to add a todo.
- **Checkbox click** toggles completion and **moves row** between TODO ↔ DONE columns.
- **× click** deletes the row permanently.
- No drag-and-drop, no inline edit of description in v1.
- No keyboard shortcuts beyond Enter to submit.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- Every interactive control has an accessible name (checkbox, add, delete).
- Checkbox state exposed to assistive technology.
- Completion distinguishable without color alone (strikethrough + column placement + checkbox state).
- Focus-visible rings on + button and checkboxes using `{colors.accent}`.
- Keyboard: Tab through add bar and list controls; Enter submits add.
- Tap targets: + button `{spacing.6}` (32px); row controls meet minimum touch size via padding.

## Responsive & Platform

| Breakpoint | Layout |
|---|---|
| ≥640px (desktop) | Two equal columns side by side. TODO left, DONE right. |
| <640px (mobile) | Columns stack vertically. TODO first, DONE second. Same add bar. |

Padding and gaps reduce per `DESIGN.md` Layout & Spacing mobile rules.

## Key Flows

### Flow 1 — Pietro dumps tasks after opening the app

1. Pietro opens the app in a browser tab.
2. Todo board loads (brief loading if fetching).
3. Add bar is focused. TODO and DONE columns show existing items.
4. He types a task and presses Enter (or clicks +).
5. New row appears at the **top** of TODO.
6. He checks two items done.
7. **Climax:** Both rows move to DONE column — open work and finished work are physically separated.
8. He closes the tab. On return, state persists.

Failure: network error on add → row removed, error shown, typed text stays in input.

### Flow 2 — Pietro clears finished work on desktop

1. Pietro opens the app on his laptop.
2. DONE column shows completed items with strikethrough.
3. He clicks × on one DONE item.
4. Row disappears immediately.
5. **Climax:** DONE column shrinks — the right column is a clean record of what's left, not a graveyard.
6. He refreshes — deletion persisted.

Failure: delete API fails → row reappears, error shown.
