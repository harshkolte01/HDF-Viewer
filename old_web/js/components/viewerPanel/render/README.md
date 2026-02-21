# js/components/viewerPanel/render

Pure render layer for viewer panel content.

## Files

- `sections.js`
  - Main display/inspect composition.
  - Renders matrix, line, and heatmap sections.
  - Builds full-runtime shells and status text.
- `previews.js`
  - Preview renderers for table, line chart, and sampled heatmap.
- `config.js`
  - Resolves runtime configs from state/preview.
  - Builds stable selection keys (line/matrix/heatmap).
- `dimensionControls.js`
  - Renders display dimension selectors and fixed-index controls.

## Full-Shell Markup Contracts

Render layer writes `data-*` attributes consumed by runtime modules, for example:

- Line shell: `data-line-*`
- Matrix shell: `data-matrix-*`
- Heatmap shell: `data-heatmap-*`

## Heatmap Plot-Mode UI (Implemented)

`sections.js` includes:

- Plot-mode toolbar icon (`data-heatmap-plot-toggle`)
- Inline linked profile panel (`data-heatmap-linked-plot`)
- Axis switch buttons (`row` / `col`)
- Close button for linked panel

Runtime owns the interactions and data loading for these controls.
