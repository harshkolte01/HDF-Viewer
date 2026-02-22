# js/components/viewerPanel

Viewer panel implementation split into render and runtime layers.

## Files

- `render.js`: panel render entrypoint.
- `runtime.js`: runtime binder entrypoint.
- `shared.js`: shared constants/helpers for matrix, line, heatmap.
- `render/`: HTML render modules.
- `runtime/`: interactive runtime engines.

## Architecture Pattern

1. Render modules create shell markup with `data-*` contracts.
2. Runtime binder discovers shell nodes and initializes matching runtime.
3. Runtime modules own interaction state and `/data` fetching.

## Current Runtime Feature Set

- Matrix: virtualized block table.
- Line: zoom/pan/click-zoom, window controls, fullscreen, compare overlays.
- Heatmap: canvas zoom/pan, progressive loading, plot-mode linked line profile, fullscreen.

## Runtime Export Contract

Each full runtime shell may attach `shell.__exportApi`:
- matrix: `exportCsvDisplayed`, `exportCsvFull`
- line: `exportCsvDisplayed`, `exportCsvFull`, `exportPng`
- heatmap: `exportCsvDisplayed`, `exportCsvFull`, `exportPng`

`viewerView.js` uses this runtime contract to execute export menu actions.
