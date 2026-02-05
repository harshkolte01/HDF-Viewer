# Frontend Implementation (HDF Viewer)

As of 2026-02-05.

## Purpose
Single-page React UI for browsing HDF5 files, navigating the file tree, and visualizing datasets with fast previews plus on-demand full data retrieval.

## Tech Stack
- React 19 + Vite
- Plain CSS with design tokens (see `frontend/src/index.css`)
- No external charting libraries; custom SVG/canvas rendering
- PropTypes for runtime prop validation

## Project Structure
- Entry: `frontend/src/main.jsx`
- App shell and navigation: `frontend/src/App.jsx`
- Pages: `frontend/src/pages/HomePage.jsx`, `frontend/src/pages/ViewerPage.jsx`
- Viewer components: `frontend/src/components/viewer/*`
- API layer: `frontend/src/api/*`
- Styles: `frontend/src/index.css`, `frontend/src/App.css`, `frontend/src/pages/ViewerPage.css`, `frontend/src/components/viewer/ViewerPanel.css`

## Environment & API Wiring
- Base URL: `VITE_API_BASE_URL` (defaults to `http://localhost:5000`).
- API endpoints live in `frontend/src/api/config.js`.
- Request client with consistent error handling in `frontend/src/api/client.js`.
- Service wrappers in `frontend/src/api/hdf5Service.js`:
  - `getFiles`, `refreshFiles`, `getFileChildren`, `getFileMeta`, `getFilePreview`, `getFileData`, `checkHealth`, `runBenchmark`.

## App Flow
### App Shell (`frontend/src/App.jsx`)
- Uses local state to switch between `HomePage` and `ViewerPage`.
- No router; navigation is state-driven.

### Home Page (`frontend/src/pages/HomePage.jsx`)
Features:
- Fetches file list from `/files` with loading/error states.
- Manual refresh via `/files/refresh` then re-fetches list.
- Search filter by filename.
- Stats bar: total files, total size, filtered count.
- Table with “Open” action to enter viewer.

### Viewer Page (`frontend/src/pages/ViewerPage.jsx`)
Layout:
- Left sidebar: file tree.
- Top bar: breadcrumb and Display/Inspect mode toggle.
- Display mode toolbar: Matrix / Line / Heatmap controls.
- Main content: `ViewerPanel`.

Core state:
- `selectedPath` (active HDF5 path)
- `viewMode` (`display` or `inspect`)
- Display configuration: `displayTab`, `displayDims`, `fixedIndices`, plus staged versions for apply/reset.
- Preview data: `preview`, `previewLoading`, `previewError`.
- Inspect metadata: `meta`, `metaLoading`, `metaError`.
- Full data modes: matrix, heatmap, line (enabled/loading/data/error states).

Data fetching behavior:
- Inspect mode calls `/files/<key>/meta?path=...`.
- Display mode calls `/files/<key>/preview?path=...` with optional `display_dims` and `fixed_indices`.
- Full data calls `/files/<key>/data` with `mode=matrix|line|heatmap` on demand.

## Viewer Components
### SidebarTree (`frontend/src/components/viewer/SidebarTree.jsx`)
- Lazy-loads children from `/files/<key>/children?path=...`.
- Tracks expanded nodes with a `Set`.
- Node model includes `type`, `path`, `numChildren`, loading state.
- Handles errors gracefully with inline messages.

### TopBar (`frontend/src/components/viewer/TopBar.jsx`)
- Breadcrumb path derived from `selectedPath`.
- Toggle between Display and Inspect.
- Back button to return to file list.

### PreviewToolbar (`frontend/src/components/viewer/PreviewToolbar.jsx`)
- Tabs: Matrix / Line Graph / Heatmap (Heatmap only when ndim >= 2).
- Controls:
  - Table: notation selector (auto/scientific/exact).
  - Line: grid toggle, aspect (line/point/both).
  - Heatmap: grid toggle, colormap (viridis/plasma/inferno/magma/cool/hot).
- Export button is present but no implementation (visual placeholder).

### ViewerPanel (`frontend/src/components/viewer/ViewerPanel.jsx`)
Display mode:
- Shows preview payload for selected dataset:
  - Table view for 1D/2D samples.
  - Line view with custom SVG chart.
  - Heatmap view with custom SVG heatmap.
- Dimension controls:
  - For 2D: axis toggle for x/y.
  - For >2D: dropdowns for display dims and sliders/inputs for fixed indices.
  - Set/Reset buttons apply staged choices.

Inspect mode:
- Simple metadata panel that mirrors backend fields (type, shape, dtype, chunks, compression, filters, attributes).
- Includes raw JSON view for debugging.

## Full Data Retrieval (Display Mode)
### Matrix (Full Table)
- Triggered by “Load full view”.
- Uses `/data` with `mode=matrix` and paging.
- Virtualized table loads blocks on scroll:
  - Block size: 200 rows x 50 cols.
  - Cache key includes file/path + dims + offsets.
- Minimizes memory and network usage for large matrices.

### Line (Full Series)
- Triggered by “Load full line”.
- Uses `/data` with `mode=line` and optional `line_dim`/`line_index`.
- Line chart supports zoom/pan and a hover tooltip.
- When zoomed, sends range-based line requests to `/data` after a short debounce.

### Heatmap (High Resolution)
- Triggered by “Load high-res”.
- Uses `/data` with `mode=heatmap` and `max_size=1024`.
- Heatmap supports:
  - Zoom/pan
  - Hover tooltip with row/col/value
  - Colormap selection
  - Optional grid overlay
- Includes a color scale bar and axis labels.

## Styling & Theme
- Theme tokens are defined in `frontend/src/index.css` and match the provided palette (background, surfaces, borders, text, primary, accent, etc.).
- `frontend/src/App.css` styles the Home page and global layout.
- `frontend/src/pages/ViewerPage.css` styles the viewer layout, sidebar, topbar, and toolbar.
- `frontend/src/components/viewer/ViewerPanel.css` styles the preview/inspect panels, charts, and tables.

## Known Gaps / Notes
- Export actions are placeholders (no implementation yet).
- No routing; navigation is local state only.
- No global state library or caching layer; all state is component-local.
- `/benchmark` is exposed in the API layer but not used in the UI.

