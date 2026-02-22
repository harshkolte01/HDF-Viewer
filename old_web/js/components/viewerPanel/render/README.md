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

Render layer writes `data-*` attributes consumed by runtime modules.

- Line shell: `data-line-*`
- Matrix shell: `data-matrix-*`
- Heatmap shell: `data-heatmap-*`

## Line Compare Render Contract (`sections.js`)

- Compare controls:
- `data-line-compare-toggle`
- `data-line-compare-clear`
- `data-line-compare-remove`
- `data-line-compare-dismiss`
- Compare payload hints on line shell:
- `data-line-compare-items`
- `data-line-base-shape`
- `data-line-base-ndim`
- `data-line-base-dtype`

## Heatmap Plot-Mode UI

`sections.js` includes:

- plot-mode toolbar icon (`data-heatmap-plot-toggle`)
- inline linked profile panel (`data-heatmap-linked-plot`)
- axis switch buttons (`row` / `col`)
- close button for linked panel

Runtime owns interactions and data loading for these controls.
