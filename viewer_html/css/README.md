# css

Main stylesheet layer for viewer shell and runtime visuals.

## What is implemented
- `tokens.css`: palette, spacing, shadows, typography, and shared CSS variables.
- `app.css`: baseline resets, home/list/table styles, and utility-level layout.
- `home.css`: shim file documenting that home styles live in `app.css`.
- `viewer.css`: shell layout (sidebar/topbar/subbar), controls, tree visuals, and responsive behavior.
- `viewer-panel.css`: inspect/display panes, matrix/line/heatmap panel styling, runtime/fullscreen states.

## How it is implemented
- Styles rely on design tokens from `tokens.css` and are split by responsibility:
  shell/navigation (`viewer.css`) vs panel/runtime (`viewer-panel.css`).
- Responsive breakpoints are included directly in CSS for mobile and tablet behavior.
- Runtime classes and `data-*` hooks are styled so JS can toggle states without inline styles.
