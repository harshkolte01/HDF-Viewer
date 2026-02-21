# css

Style system for `old_web`.

## Load Order (from `old_web/index.html`)

1. `tokens.css`
2. `app.css`
3. `home.css`
4. `viewer.css`
5. `viewer-panel.css`
6. `components/tree.css`
7. `components/table.css`
8. `components/charts.css`

## Active Ownership

- `tokens.css`: color, spacing, radius, shadow, and semantic design tokens.
- `app.css`: global app shell + home page base styling.
- `home.css`: small home-specific extensions.
- `viewer.css`: viewer layout (sidebar, top bars, tabs, responsive drawer/fullscreen shell).
- `viewer-panel.css`: matrix/line/heatmap panel visuals and interactive runtime states.
- `components/table.css`: home file table styling.
- `components/charts.css`: generic chart surface class.

## Important Runtime Classes

- Viewer fullscreen shell: `.viewer-page:fullscreen`
- Panel fullscreen lock: `body.line-panel-fullscreen-active`
- Line panel fullscreen: `.line-chart-shell.is-fullscreen`
- Heatmap plot mode: `.heatmap-chart-canvas.is-plot`
- Heatmap pan mode: `.heatmap-chart-canvas.is-pan`
- Inline linked line shell: `.heatmap-inline-line-shell`

## Files Not Loaded by `index.html`

- `reset.css`
- `theme.css`
- `common.css`

These are retained for compatibility/history and can be removed only after confirming no external dependency.
