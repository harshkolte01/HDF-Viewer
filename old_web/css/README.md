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

## File Ownership

- `tokens.css`: design tokens (color, spacing, radii, shadows).
- `app.css`: global shell and home baseline styles.
- `home.css`: home-specific extensions.
- `viewer.css`: viewer layout, sidebar tree, top/sub bars, compare tree UX, export menu UX, responsive layout.
- `viewer-panel.css`: matrix, line, and heatmap panel visuals and runtime interaction states.
- `components/table.css`: home file table styles.
- `components/charts.css`: shared chart-surface utility.

## Compare-Related Classes

Tree compare controls in `viewer.css`:
- `.tree-compare-btn`
- `.tree-compare-btn.is-disabled`
- `.sidebar-tree.is-compare-mode`

Compare mode tree behavior:
- enables horizontal scrolling for long labels
- relaxes text truncation for dataset names
- keeps compare button visible on wide rows

Line compare panel in `viewer-panel.css`:
- `.line-compare-panel`
- `.line-compare-chip*`
- `.line-compare-status*`
- `.line-legend*`
- `.line-path-base`
- `.line-path-compare`

## Export-Related Classes

Subbar export menu in `viewer.css`:
- `.subbar-export-wrap`
- `.subbar-export`
- `.subbar-export-menu`
- `.subbar-export-item`
- `.subbar-export-wrap.is-open .subbar-export-menu`

Current visibility model:
- menu is hidden by default (`display: none`)
- menu appears when wrapper has `.is-open`
- `viewer-subbar` has explicit stacking context for reliable overlay rendering

## Important Runtime State Classes

- Global fullscreen: `.viewer-page:fullscreen`
- Line panel fullscreen lock: `body.line-panel-fullscreen-active`
- Line panel fullscreen shell: `.line-chart-shell.is-fullscreen`
- Heatmap pan/plot modes: `.heatmap-chart-canvas.is-pan`, `.heatmap-chart-canvas.is-plot`
- Inline linked plot shell: `.heatmap-inline-line-shell`

## Not Loaded by `index.html`

- `reset.css`
- `theme.css`
- `common.css`

These files are retained for compatibility/history.
