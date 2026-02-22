# js/components/viewerPanel/runtime

Interactive runtime layer for full matrix, line, and heatmap views.

## Files

- `bindEvents.js`: central post-render binder.
- `common.js`: cleanup registries and shared status helpers.
- `matrixRuntime.js`: virtualized matrix table and block streaming.
- `lineRuntime.js`: line chart interaction engine and compare overlay.
- `heatmapRuntime.js`: heatmap interaction engine and linked line profile.

## Shared Runtime Guarantees

- Cleanup isolation per runtime type via registry sets.
- Selection-key based view persistence where applicable.
- Explicit teardown of event listeners, timers, and pending requests.

## Line Runtime Highlights

- Windowed fetch and render (`viewStart`, `viewSpan`).
- Pan, wheel zoom, click-to-zoom, keyboard navigation.
- Fullscreen shell state handling.
- Compare overlays with shared axes and legend/status reporting.

## Heatmap Runtime Highlights

- Progressive loading (preview then higher resolution).
- Canvas zoom/pan and tooltip.
- Plot mode for row/column linked line profiles.
- Fullscreen shell state handling.

## Matrix Runtime Highlights

- Virtualized matrix viewport.
- Block queue with bounded parallel requests.
- On-demand cache hydration for export-visible ranges.

## Export Implementation by Runtime

- `matrixRuntime.js`
- `exportCsvDisplayed()`: exports currently visible viewport.
- `exportCsvFull()`: starts backend streamed CSV export for full selected matrix slice.

- `lineRuntime.js`
- `exportCsvDisplayed()`: exports current plotted base points plus loaded compare series.
- `exportCsvFull()`: starts backend streamed line CSV export and includes `compare_paths` when present.
- `exportPng()`: rasterizes active line SVG to PNG.

- `heatmapRuntime.js`
- `exportCsvDisplayed()`: exports currently loaded heatmap grid.
- `exportCsvFull()`: starts backend streamed CSV export for full selected heatmap slice.
- `exportPng()`: exports rendered heatmap canvas to PNG.

Each runtime registers these handlers via `shell.__exportApi` for the top-level export menu.
