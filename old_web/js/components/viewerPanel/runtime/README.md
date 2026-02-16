# js/components/viewerPanel/runtime

Interactive runtime layer for full matrix, line, and heatmap views.

## Files

- `bindEvents.js`
  - Central binder for panel-level controls and runtime initialization.
  - Calls cleanup first, then binds dimension/apply/reset and full-view buttons.
- `common.js`
  - Shared cleanup registries and DOM helper utilities.
- `matrixRuntime.js`
  - Virtualized matrix runtime with block fetching and scroll-driven rendering.
- `lineRuntime.js`
  - Full line runtime with zoom, pan, range/window controls, and fullscreen behavior.
- `heatmapRuntime.js`
  - Canvas heatmap runtime with zoom/pan, tooltip, and high-resolution refinement path.

## Imported By

- `old_web/js/components/viewerPanel/runtime.js` re-exports `bindViewerPanelEvents` from `bindEvents.js`.
- `bindEvents.js` imports and initializes all runtime modules.

## API Dependencies

- Runtime modules fetch data through `old_web/js/api/hdf5Service.js` (`getFileData`).
- Some modules use `cancelPendingRequest` from `old_web/js/api/client.js` for request cancellation.
