# js/components/viewerPanel

Viewer panel implementation split into render and runtime layers.

## Files

- `render.js`
  - Builds panel shell and chooses inspect/display renderer.
  - Re-exports selection-key helpers from `render/config.js`.
- `runtime.js`
  - Re-exports `bindViewerPanelEvents` from runtime binder.
- `shared.js`
  - Shared constants and helpers for matrix, line, and heatmap rendering and config normalization.
- `render/`
  - HTML generation for inspect and display sections.
- `runtime/`
  - Event bindings and full-view runtime engines.

## Imported By

- `old_web/js/components/viewerPanel.js` (facade) re-exports from this folder.
- `old_web/js/views/viewerView.js` imports the facade.

## Internal Dependency Pattern

- Render modules depend on `shared.js` and `render/config.js`.
- Runtime modules depend on `shared.js`, runtime `common.js`, API service, and config helpers.
