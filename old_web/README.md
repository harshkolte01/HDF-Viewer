# old_web Frontend

`old_web` is the active static frontend for HDF Viewer.
It is a plain ES-module SPA (no bundler) served from `old_web/index.html`.

## Quick Start

1. Serve repository root over HTTP.

```bash
python -m http.server 8080
```

2. Open `http://localhost:8080/old_web/index.html`.
3. Confirm backend URL via:
- `old_web/js/config.js`, or
- `old_web/config/runtime-config.js` (`window.__CONFIG__.API_BASE_URL`).

## Runtime Entry Flow

1. `old_web/index.html` loads CSS and runtime config.
2. `old_web/js/app.js` bootstraps state + templates and starts render loop.
3. Route render switches by `state.route`:
- `home` -> `old_web/js/views/homeView.js`
- `viewer` -> `old_web/js/views/viewerView.js`

## Current Feature Set

- Home file list with search, refresh, and open-file action.
- Viewer sidebar tree with lazy load, retries, and dataset/group selection.
- Display/Inspect mode switching and breadcrumb navigation.
- Display tabs:
- Matrix preview + full virtualized matrix runtime.
- Line preview + full interactive line runtime.
- Heatmap preview + full interactive canvas runtime.
- N-dimensional display controls (`displayDims`, `fixedIndices`) with stage/apply flow.
- Inspect metadata summary + raw JSON.

## Line Compare Mode (Implemented)

Line compare is frontend-only V1 and reuses the existing `/data` line endpoint.

### User workflow

1. Select a base dataset and load its preview.
2. In line full view, toggle `Compare On`.
3. In tree, `Compare` button appears only for compatible datasets.
4. Add up to 4 compare datasets.
5. Base + compare series render on the same line chart with shared axes.

### Compatibility rules

- Node must be a dataset.
- Base and candidate dtype must be numeric.
- Same `ndim`.
- Same `shape`.
- Candidate cannot be the base path.
- Max compare selections: 4.

### Validation checkpoints

- Tree render-time gate: only compatible nodes show `Compare`.
- Add-time reducer validation: hard block with user-facing status.
- Runtime precheck + fetch-time guard: incompatible/failing series are skipped and listed in legend/status.

### Compare UI details

- Line panel controls: `Compare On/Off`, `Clear compare`, removable compare chips, dismissible status banner.
- Tree compare mode supports horizontal scroll for long names (`.sidebar-tree.is-compare-mode`).
- Legend shows base + compare color mapping and skipped series reasons.

## Full Runtime Behaviors

- Line runtime:
- Wheel zoom, pan tool, click-zoom tool, range navigation, quality/window controls, panel fullscreen.
- Parallel base+compare requests (`Promise.allSettled`) for current window.
- Shared x/y domain rendering and compare overlay paths.
- Heatmap linked selection marker compatibility retained.
- Heatmap runtime:
- Progressive hi-res loading, zoom/pan, tooltip, panel fullscreen.
- Plot mode, linked inline line profile, row/column switching.

## Key Modules

- App shell: `old_web/js/app.js`
- State store: `old_web/js/state/store.js`
- Reducer composition: `old_web/js/state/reducers.js`
- Compare actions: `old_web/js/state/reducers/compareActions.js`
- Tree compare UI: `old_web/js/components/sidebarTree.js`
- Panel render controls: `old_web/js/components/viewerPanel/render/sections.js`
- Line runtime compare overlay: `old_web/js/components/viewerPanel/runtime/lineRuntime.js`
- API/cache service: `old_web/js/api/hdf5Service.js`

## Active API Endpoints

- `GET /files`
- `POST /files/refresh`
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`

## Folder Map

- `old_web/assets/` static assets.
- `old_web/config/` runtime config loaded before modules.
- `old_web/css/` tokens, layout, panel, and component styles.
- `old_web/docs/` old_web-scoped architecture notes.
- `old_web/js/` SPA logic, state/actions, API, views, runtime engines.
- `old_web/pages/` HTML templates for route views.
- `old_web/viewer/` legacy redirect shim.

## Legacy Compatibility Files

Retained for compatibility/history, not in active runtime path:

- `old_web/js/router.js`
- `old_web/js/components/Component.js`
- `old_web/js/components/HomePage.js`
- `old_web/js/components/ViewerPage.js`
- `old_web/js/components/viewer/*`
- `old_web/js/visualizations/*`
- `old_web/js/utils/cache.js`
- `old_web/js/utils/dom.js`
- `old_web/js/utils/formatters.js`
- `old_web/viewer.html` and `old_web/viewer/index.html`

## Recommended Read Order

1. `old_web/js/app.js`
2. `old_web/js/state/store.js`
3. `old_web/js/state/reducers.js`
4. `old_web/js/state/reducers/compareActions.js`
5. `old_web/js/views/viewerView.js`
6. `old_web/js/components/sidebarTree.js`
7. `old_web/js/components/viewerPanel/render/sections.js`
8. `old_web/js/components/viewerPanel/runtime/bindEvents.js`
9. `old_web/js/components/viewerPanel/runtime/lineRuntime.js`
10. `old_web/js/components/viewerPanel/runtime/heatmapRuntime.js`
