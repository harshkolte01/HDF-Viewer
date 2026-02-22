# js/components/viewerPanel/runtime

Interactive runtime layer for full matrix, line, and heatmap views.

## Files

- `bindEvents.js`
- Central post-render binder.
- Binds panel controls and initializes matrix/line/heatmap runtimes.
- Includes line compare control bindings.
- `common.js`
- Cleanup registries and shared helpers.
- `matrixRuntime.js`
- Virtualized matrix renderer + block queue/pump/fetch.
- `lineRuntime.js`
- Full line runtime with zoom, pan, click-zoom, quality/window controls, fullscreen, and compare overlays.
- `heatmapRuntime.js`
- Full heatmap runtime with progressive hi-res loading, zoom/pan, plot mode, linked inline line profile, fullscreen.

## Key Behaviors Implemented

- Runtime cleanup isolation via:
- `MATRIX_RUNTIME_CLEANUPS`
- `LINE_RUNTIME_CLEANUPS`
- `HEATMAP_RUNTIME_CLEANUPS`
- Selection/view caching for faster re-entry.
- Fullscreen state restore guards across rerenders.
- Heatmap plot-mode cell selection feeding inline linked line shell creation.
- Inline linked line scroll-position protection.

## Line Compare Runtime Sequence (`lineRuntime.js`)

1. Parse compare items + base hints from shell dataset attrs.
2. Pre-check compare items (dtype/ndim/shape).
3. Fetch base + compare windows in parallel using `getFileData(... mode=line ...)`.
4. Keep base-series zoom/pan logic as source of viewport truth.
5. Render base + compare series on shared axes.
6. Show legend entries for loaded series and skipped/failing series reasons.

## API Usage

- Matrix/line/heatmap runtimes fetch via `getFileData()` from `js/api/hdf5Service.js`.
- Runtime cancellation uses cancel channels via `cancelPendingRequest()` where required.
