# js/components/viewerPanel/render

Pure render layer for viewer panel content.

## Files

- `sections.js`
  - Main inspect and display composition.
  - Renders metadata blocks, preview sections, and full-view shells for matrix, line, and heatmap.
- `previews.js`
  - Renders preview visuals (table, line preview, heatmap preview).
- `config.js`
  - Builds runtime selection keys and resolves runtime config for line, matrix, and heatmap.
- `dimensionControls.js`
  - Renders display-dimension and fixed-index controls.

## Imported By

- `old_web/js/components/viewerPanel/render.js` imports `sections.js`.
- Runtime modules import key builders and resolvers from `config.js`.
- `sections.js` imports preview renderers and dimension controls.

## Important Behavior

- Full-view modes are rendered as shell markup with `data-*` attributes.
- Runtime modules use those attributes to initialize interactive behavior after DOM render.
