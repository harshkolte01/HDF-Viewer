# js/components/viewerPanel

Viewer panel implementation split into render and runtime layers.

## Files

- `render.js`
- Entrypoint for panel HTML generation.
- Switches display/inspect content and exports selection-key helpers.
- `runtime.js`
- Entrypoint re-export for runtime event binder.
- `shared.js`
- Shared constants/helpers for matrix, line, and heatmap behavior.
- `render/`
- Pure HTML render modules (shell markup + controls).
- `runtime/`
- Interactive runtime engines and cleanup utilities.

## Architecture Pattern

1. Render modules output shell markup with `data-*` attributes.
2. Runtime binder scans shells and initializes matching runtime module.
3. Runtime modules own interactive behavior and `/data` fetching.

## Key Runtime Features

- Matrix: virtual block streaming table.
- Line: windowed fetching, zoom/pan/click-zoom, range controls, panel fullscreen.
- Line compare V1:
- compare toggle/clear/remove controls in panel
- shared-axes overlay of base + compare datasets
- legend entries for loaded and skipped compare series
- Heatmap: canvas zoom/pan, high-res progressive loading, plot-mode linked inline line profile.
