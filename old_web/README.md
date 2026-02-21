# old_web Frontend

`old_web` is the current static frontend for HDF Viewer.
It is a plain ES modules app (no bundler) that runs as a single-page app inside `old_web/index.html`.

## Quick Start

1. Serve repository root over HTTP:

```bash
python -m http.server 8080
```

2. Open `http://localhost:8080/old_web/index.html`.
3. Make sure backend is reachable from `old_web/js/config.js` (`API_BASE_URL`) or via `old_web/config/runtime-config.js`.

## Runtime Entry

1. `old_web/index.html` loads CSS and `config/runtime-config.js`.
2. `old_web/js/app.js` bootstraps templates, subscribes render loop, and loads files.
3. Render switches by `state.route`:
   - `home` -> `old_web/js/views/homeView.js`
   - `viewer` -> `old_web/js/views/viewerView.js`

## Current Feature Set

- Home file list with search, refresh, and open-file action.
- Viewer sidebar tree with lazy child loading, loading states, and retry states.
- Breadcrumb navigation and display/inspect mode switching.
- Display mode tabs:
  - Matrix preview and full virtualized block streaming.
  - Line preview and full interactive line runtime.
  - Heatmap preview and full interactive canvas runtime.
- N-dimensional display controls (display dims + fixed indices) with staged/apply flow.
- Inspect mode metadata summary plus raw JSON.

## Full Runtime Behaviors Implemented

- Line full runtime:
  - Wheel zoom, pan tool, click-zoom tool, range navigation, quality/window controls, panel fullscreen.
  - Selection marker rendering for linked heatmap plots.
- Heatmap full runtime:
  - Progressive high-res loading (preview size first, then full size).
  - Pan/zoom, tooltip, panel fullscreen.
  - Plot mode toggle (crosshair icon), cell selection, inline linked line-profile panel.
  - Row/column switch for linked profile and close action.
  - Inline linked profile scroll-jump protection and fullscreen isolation compatibility.

## Key Modules

- App shell: `old_web/js/app.js`
- State container: `old_web/js/state/store.js`
- Action composition: `old_web/js/state/reducers.js`
- API and frontend cache: `old_web/js/api/*`
- Views: `old_web/js/views/*`
- Viewer panel render/runtime: `old_web/js/components/viewerPanel/*`

## Folder Map

- `old_web/assets/` static assets.
- `old_web/config/` runtime config injected before modules.
- `old_web/css/` tokens + home/viewer/panel styling.
- `old_web/docs/` old_web-specific historical docs.
- `old_web/js/` app logic, state/actions, API, views, runtimes.
- `old_web/pages/` HTML templates loaded by views.
- `old_web/viewer/` legacy redirect route.

## Active API Endpoints

- `GET /files`
- `POST /files/refresh`
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`

## Legacy / Compatibility Files

These are retained for compatibility/history and are not part of active rendering/runtime flow:

- `old_web/js/router.js`
- `old_web/js/components/Component.js`
- `old_web/js/components/HomePage.js`
- `old_web/js/components/ViewerPage.js`
- `old_web/js/components/viewer/*`
- `old_web/js/visualizations/*`
- `old_web/js/utils/cache.js`
- `old_web/js/utils/dom.js`
- `old_web/js/utils/formatters.js`
- `old_web/viewer.html` and `old_web/viewer/index.html` (redirect shims)

## Recommended Reading Order

1. `old_web/js/app.js`
2. `old_web/js/state/store.js`
3. `old_web/js/state/reducers.js`
4. `old_web/js/views/viewerView.js`
5. `old_web/js/components/viewerPanel/render/sections.js`
6. `old_web/js/components/viewerPanel/runtime/bindEvents.js`
7. `old_web/js/components/viewerPanel/runtime/lineRuntime.js`
8. `old_web/js/components/viewerPanel/runtime/heatmapRuntime.js`
