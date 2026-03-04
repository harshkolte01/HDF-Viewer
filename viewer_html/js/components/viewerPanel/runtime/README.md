# js/components/viewerPanel/runtime

Interactive runtime engines for matrix, line, and heatmap full views.

## What is implemented
- `common.js`: runtime cleanup sets and shared helper utilities.
- `bindEvents.js`: delegated panel control handling and per-shell runtime initialization.
- `matrixRuntime.js`: block-virtualized matrix scrolling, block queueing, and CSV export.
- `lineRuntime.js`: zoom/pan/click-zoom chart runtime, compare overlays, quality/window controls, fullscreen, export.
- `heatmapRuntime.js`: canvas heatmap runtime with zoom/pan, plot mode linked line chart, progressive loading, fullscreen, export.

## How it is implemented
- Each runtime attaches to a shell node created by render modules and reads `data-*` config.
- Requests use API service helpers with cancellation and stale update safeguards.
- Runtimes publish `shell.__exportApi` handlers consumed by the global export menu.
- Cleanup handlers are registered so rerendering can safely dispose active listeners and in-flight work.
