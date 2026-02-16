# css

Style system for old_web.

## Load Order from `old_web/index.html`

1. `tokens.css`
2. `app.css`
3. `home.css`
4. `viewer.css`
5. `viewer-panel.css`
6. `components/tree.css`
7. `components/table.css`
8. `components/charts.css`

## Implemented Files

- `tokens.css`: design tokens (colors, spacing, radius, shadows).
- `app.css`: shared layout, navbar, home page states, utilities.
- `home.css`: minimal file, points to home styles living in `app.css`.
- `viewer.css`: viewer layout, sidebar/tree, top bars, responsive behavior.
- `viewer-panel.css`: inspect/display panel, matrix/line/heatmap panel styling.
- `reset.css`: basic margin/padding/box model reset.
- `theme.css`: legacy token/base duplication kept for compatibility.

## Placeholder

- `common.css`: currently empty.

## Notes for New Developers

- Primary active styling is in `app.css`, `viewer.css`, and `viewer-panel.css`.
- Keep tokens in `tokens.css` aligned with project palette.
