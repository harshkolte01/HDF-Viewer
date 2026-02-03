# Data Integration Plan - Phase 3

## Flow (Keep Preview Fast)
1. On dataset click, call `/meta` immediately.
2. On dataset click, call `/preview` immediately.
3. Defer `/data` until user interaction (scroll, zoom, change dims, or explicit "Load full view" action).
4. Do not auto-load `/data` on click for large datasets.

## Matrix/Table Integration
1. Use a virtualized table (react-window or similar).
2. Initial request should be small (e.g., 200 x 50).
3. As the user scrolls, request the next block.
4. Cache blocks client-side by `path`, `selection`, `row_offset`, `col_offset`, `row_limit`, `col_limit`.

## Heatmap Integration
1. Stage 1: use `/preview` heatmap (512 x 512).
2. Stage 2: on zoom or region selection, call `/data?mode=heatmap` with tighter selection or higher `max_size`.
3. Optional region selection for focused inspection.
4. Eventually add ROI selection (`x0,x1,y0,y1`) to fetch only that region at higher resolution.

## Line Graph Integration
1. Always plot 5000 points or fewer.
2. On zoom, request a narrower slice instead of more points.
3. Backend returns downsampled points for the slice to preserve performance.

## Goal
Fast initial render with preview, and responsive interaction by fetching only what is visible.
