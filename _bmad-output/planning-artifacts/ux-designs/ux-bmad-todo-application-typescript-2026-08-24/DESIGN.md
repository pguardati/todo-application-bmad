---
name: Todo
description: Personal minimal todo app. Black canvas, green accent, no chrome.
status: final
created: 2026-08-24
updated: 2026-08-24
colors:
  canvas: '#000000'
  text: '#E8E8E8'
  text-muted: '#666666'
  text-done: '#555555'
  accent: '#4CAF6A'
  accent-hover: '#6FD98A'
  border: '#222222'
  control: '#444444'
  control-hover: '#888888'
typography:
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: '400'
    lineHeight: '1.4'
  section-label:
    fontSize: '0.75rem'
    fontWeight: '600'
    letterSpacing: '0.12em'
    textTransform: 'uppercase'
rounded:
  sm: 0px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
components:
  section-label:
    color: '{colors.accent}'
    fontSize: '{typography.section-label.fontSize}'
    fontWeight: '{typography.section-label.fontWeight}'
    letterSpacing: '{typography.section-label.letterSpacing}'
  field-input:
    color: '{colors.text}'
    fontSize: '{typography.body.fontSize}'
    borderBottom: '1px solid {colors.border}'
    focusBorderColor: '{colors.accent}'
  btn-icon-accent:
    color: '{colors.accent}'
    hoverColor: '{colors.accent-hover}'
  btn-icon-muted:
    color: '{colors.control}'
    hoverColor: '{colors.control-hover}'
  todo-row:
    borderBottom: '1px solid {colors.border}'
    paddingY: '{spacing.3}'
    gap: '{spacing.3}'
  checkbox:
    accentColor: '{colors.accent}'
    size: '1rem'
---

## Brand & Style

A personal task surface with almost no UI. Black background, two columns, two labels — **TODO** and **DONE**. Green appears only where the eye needs a anchor: section titles, the add control, focus, and completion checkboxes. Everything else is neutral gray on black. Underlines divide items; no cards, no shadows, no decoration.

## Colors

- **Canvas (`{colors.canvas}`)** — full-page background. Always black.
- **Text (`{colors.text}`)** — active todo descriptions and input text.
- **Text Done (`{colors.text-done}`)** — completed items. Strikethrough applied in component layer.
- **Accent (`{colors.accent}` / `{colors.accent-hover}`)** — section labels, + button, checkbox accent, add-bar focus underline. The only chromatic color.
- **Border (`{colors.border}`)** — all dividers: row underlines, add-bar baseline. One token, one weight (1px).
- **Control (`{colors.control}` / `{colors.control-hover}`)** — secondary icon buttons (delete ×). Never accent green.

Avoid: colored backgrounds on columns, multiple accent hues, box shadows, pill shapes.

## Typography

System stack only (`{typography.body.fontFamily}`). Body at `{typography.body.fontSize}` for items and input. Section labels at `{typography.section-label.fontSize}`, uppercase, `{typography.section-label.letterSpacing}`. No other heading levels on screen.

## Layout & Spacing

Scale: `{spacing.1}` through `{spacing.8}` (4–64px). App padding `{spacing.6}` horizontal `{spacing.7}`. Column gap `{spacing.8}`. Row padding `{spacing.3}` vertical. Add bar gap `{spacing.3}`, margin below `{spacing.8}`.

Desktop: two equal columns. Mobile (<640px): stack columns, reduce padding to `{spacing.5}`, column gap `{spacing.6}`.

## Elevation & Depth

None. Flat black canvas. Hierarchy from layout and text color only.

## Shapes

No border radius (`{rounded.sm}` = 0). Square checkboxes, flat inputs, no pills.

## Components

- **Section label** — `{components.section-label}`. Only visible titles: TODO, DONE.
- **Add bar** — `{components.btn-icon-accent}` + `{components.field-input}`. + left of input. Bar underline turns `{colors.accent}` on `:focus-within`.
- **Todo row** — checkbox (`{components.checkbox}`) · label · delete (`{components.btn-icon-muted}`). `{components.todo-row}` divider between rows. Checked row moves to DONE column; label gets strikethrough + `{colors.text-done}`.
- **Delete control** — × icon button, `{colors.control}` at rest, `{colors.control-hover}` on hover.

→ Board composition: [`mockups/main.html`](mockups/main.html). Spine wins on conflict.

## Do's and Don'ts

**Do:** use `{colors.accent}` for every primary interactive affordance; use `{colors.border}` for every divider; keep the screen to two labels plus list content.

**Don't:** add green backgrounds, extra headings, placeholder text in the input, or red delete styling.
