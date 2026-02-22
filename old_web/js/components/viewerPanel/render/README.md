# js/components/viewerPanel/render

Pure render layer for viewer panel content.

## Files

- `sections.js`: main display/inspect composition and shell markup.
- `previews.js`: preview renderers for matrix, line, and heatmap.
- `config.js`: derives runtime config and stable selection keys.
- `dimensionControls.js`: display dimension selectors and fixed-index controls.

## Render Contract

Render modules output `data-*` attributes consumed by runtime modules:
- matrix shell: `data-matrix-*`
- line shell: `data-line-*`
- heatmap shell: `data-heatmap-*`

## Line Compare Render Contract

`sections.js` includes compare-specific attributes and controls:
- `data-line-compare-items`
- `data-line-base-shape`
- `data-line-base-ndim`
- `data-line-base-dtype`
- `data-line-compare-toggle`
- `data-line-compare-clear`
- `data-line-compare-remove`
- `data-line-compare-dismiss`

## Status Anchors Used by Runtime and Export

- matrix status: `data-matrix-status`
- line status: `data-line-status`
- heatmap status: `data-heatmap-status`

Export UI itself is rendered by `views/viewerView.js`, while these status anchors are updated by runtime/export operations.
