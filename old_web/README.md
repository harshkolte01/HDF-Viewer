# old_web Frontend (Active)

`old_web/` is the production static frontend for HDF Viewer.
It is a no-bundler ES module SPA loaded from `old_web/index.html`.

## Quick Start

1. Start a static server from repository root.

```bash
python -m http.server 8080
```

2. Open `http://localhost:8080/old_web/index.html`.
3. Set backend URL by either:
- editing `old_web/config/runtime-config.js`, or
- setting `window.__CONFIG__.API_BASE_URL` before modules load.

## Runtime Boot Flow

1. `old_web/index.html` loads CSS, runtime config, then `js/app.js`.
2. `js/app.js` initializes templates and state, then renders by route:
- `home` -> `js/views/homeView.js`
- `viewer` -> `js/views/viewerView.js`
3. Viewer route binds:
- tree controls (`js/components/sidebarTree.js`)
- panel controls and runtimes (`js/components/viewerPanel/runtime/bindEvents.js`)

## Implemented Features

- Home file list with search, refresh, and open-file action.
- Home list includes both `file` and `folder` entries from backend.
- Folder rows are visible but are not openable in viewer mode.
- Lazy tree browsing for HDF5 groups and datasets.
- Dataset preview and full runtime for Matrix, Line Graph, and Heatmap.
- N-dimensional selection with `displayDims` and `fixedIndices`.
- Inspect mode with metadata summary and raw JSON.
- Line compare mode (frontend-managed, up to 4 compare datasets).
- Export menu for display tabs (CSV and PNG where supported).

## Line Compare (Current Behavior)

Compare is available only in `Viewer -> Display -> Line` and only after compare mode is enabled.

Compatibility checks are enforced at three stages:
1. Tree render gate (`js/components/sidebarTree.js`):
- Compare button is rendered only for compatible datasets.
2. Action validation (`js/state/reducers/compareActions.js`):
- dataset only
- numeric dtype
- same `ndim`
- same `shape`
- not base path
- max 4 compare items
3. Runtime precheck (`js/components/viewerPanel/runtime/lineRuntime.js`):
- fetch/shape mismatches are skipped and surfaced in legend/status.

## Export (Current Behavior)

Export UI lives in `js/views/viewerView.js` and dispatches to runtime handlers via `shell.__exportApi`.

- Matrix tab:
- `CSV (Displayed)`: visible viewport of full matrix table.
- `CSV (Full)`: full selected 2D slice via backend export endpoint.
- Line Graph tab:
- `CSV (Displayed)`: currently plotted base window plus loaded compare series.
- `CSV (Full)`: full selected line via backend export endpoint (includes `compare_paths` when compare mode is active).
- `PNG (Current View)`: exported from rendered line SVG.
- Heatmap tab:
- `CSV (Displayed)`: currently loaded heatmap grid in runtime.
- `CSV (Full)`: full selected 2D slice via backend export endpoint.
- `PNG (Current View)`: exported from rendered heatmap canvas.

Important notes:
- Export actions require full runtime shell for the active tab.
- If full view is not loaded, UI shows: `Load full ... before exporting.`
- Shared export helpers are implemented in `js/utils/export.js`.
- CSV export helpers now prefix formula-like values to prevent spreadsheet formula injection.

## Backend Contract Required by old_web

Used endpoints:
- `GET /files`
- `POST /files/refresh`
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`
- `GET /files/<key>/export/csv`

`/export/csv` is used for full CSV downloads (matrix, line, heatmap).

## Folder Map

- `assets/`: static assets.
- `config/`: runtime config loaded before modules.
- `css/`: tokens, layout, and panel styles.
- `docs/`: old_web-specific plans and summaries.
- `js/`: app logic, state, views, components, runtimes.
- `pages/`: HTML templates loaded by template loader.
- `viewer/`: legacy redirect shim.

## Recommended Read Order for New Developers

1. `old_web/js/app.js`
2. `old_web/js/state/store.js`
3. `old_web/js/state/reducers.js`
4. `old_web/js/views/viewerView.js`
5. `old_web/js/components/sidebarTree.js`
6. `old_web/js/components/viewerPanel/render/sections.js`
7. `old_web/js/components/viewerPanel/runtime/bindEvents.js`
8. `old_web/js/components/viewerPanel/runtime/matrixRuntime.js`
9. `old_web/js/components/viewerPanel/runtime/lineRuntime.js`
10. `old_web/js/components/viewerPanel/runtime/heatmapRuntime.js`
11. `old_web/js/utils/export.js`

## Legacy Compatibility Files

Kept for backward compatibility/history and not used by active runtime:
- `old_web/js/router.js`
- `old_web/js/components/viewer/*`
- `old_web/js/visualizations/*`
- `old_web/js/components/Component.js`
- `old_web/js/components/HomePage.js`
- `old_web/js/components/ViewerPage.js`
- `old_web/viewer.html`
- `old_web/viewer/index.html`
