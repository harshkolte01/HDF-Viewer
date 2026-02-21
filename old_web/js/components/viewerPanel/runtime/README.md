# js/components/viewerPanel/runtime

Interactive runtime layer for full matrix, line, and heatmap views.

## Files

- `bindEvents.js`
  - Central post-render binder.
  - Binds panel controls and initializes matrix/line/heatmap runtimes.
- `common.js`
  - Cleanup registries and shared helpers.
- `matrixRuntime.js`
  - Virtualized matrix renderer + block queue/pump/fetch.
- `lineRuntime.js`
  - Full line runtime with zoom, pan, click-zoom, quality/window controls, fullscreen.
- `heatmapRuntime.js`
  - Full heatmap canvas runtime with progressive high-res loading, zoom/pan, plot mode, linked inline line profile, fullscreen.

## Key Behaviors Implemented

- Runtime cleanup isolation via `MATRIX_RUNTIME_CLEANUPS`, `LINE_RUNTIME_CLEANUPS`, `HEATMAP_RUNTIME_CLEANUPS`.
- Selection/view caching for fast re-entry.
- Fullscreen state restore guards across rerenders (line and heatmap panel shells).
- Heatmap plot-mode cell selection feeding inline line-profile shell creation.
- Inline linked line scroll-jump mitigation and scroll-position restoration.
- Pointer-event flow tuned for pan vs plot selection modes.

## API Usage

- Matrix/line/heatmap runtime fetches use `getFileData()` from `js/api/hdf5Service.js`.
- Runtime cancellation uses cancel channels via `cancelPendingRequest()` where needed.
