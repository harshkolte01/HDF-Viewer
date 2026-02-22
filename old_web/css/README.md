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

- `tokens.css`: design tokens (color, spacing, radii, shadows).
- `app.css`: global shell + home baseline.
- `home.css`: home-specific extensions.
- `viewer.css`: viewer layout, sidebar, breadcrumb, toolbar, responsive behavior.
- `viewer-panel.css`: matrix/line/heatmap panel styling and runtime states.
- `components/table.css`: home table styling.
- `components/charts.css`: generic chart surface utility.

## Compare-Related Classes

### Tree compare controls (`viewer.css`)

- `.tree-compare-btn`
- `.tree-compare-btn.is-disabled`
- `.sidebar-tree.is-compare-mode`
- Compare mode enables horizontal tree scrolling for long labels:
- `overflow-x: auto`
- max-content widths on tree wrappers/rows
- no label ellipsis clipping while compare mode is active

### Line compare panel and legend (`viewer-panel.css`)

- `.line-compare-panel`
- `.line-compare-chip*`
- `.line-compare-status*`
- `.line-path-base`
- `.line-path-compare`

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
