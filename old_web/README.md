# old_web Frontend

## Purpose
`old_web` is the legacy static frontend for HDF Viewer.
It is a plain ES modules app (no bundler) that talks to the Flask backend for file listing, tree navigation, metadata, preview payloads, and full data windows.

## Runtime Architecture
1. `old_web/index.html` loads CSS, then `config/runtime-config.js`, then `js/app.js`.
2. `js/config.js` resolves API base URL from `window.__CONFIG__.API_BASE_URL` (fallback default).
3. `js/state/store.js` holds global app state.
4. `js/state/reducers.js` composes action creators from modular reducer files.
5. `js/app.js` renders either Home or Viewer based on `state.route`, then binds events.
6. Views render components:
   - Home: `js/views/homeView.js`
   - Viewer: `js/views/viewerView.js`
7. API calls go through:
   - `js/api/client.js` (request + cancellation + error mapping)
   - `js/api/hdf5Service.js` (endpoint functions + frontend cache)
8. Viewer display modes (`table`, `line`, `heatmap`) are handled by `js/components/viewerPanel/*`.

## Key Features Implemented
- Home file table with search, refresh, open-file action.
- Viewer sidebar tree with lazy expansion, loading states, retry states.
- Breadcrumb navigation + display/inspect mode toggle.
- Display mode:
  - Matrix preview table and full virtualized matrix streaming.
  - Line preview SVG and full interactive line runtime (zoom, pan, range window, quality mode, fullscreen).
  - Heatmap preview SVG and full interactive canvas runtime (zoom, pan, tooltip, fullscreen, high-res fetch).
- Inspect mode with metadata summary + raw JSON.
- N-dimensional display controls (display dims + fixed indices) with staged/apply workflow.

## Folder Map
- `assets/` static assets.
- `config/` runtime config injected before modules.
- `css/` global + page + panel styles.
- `docs/` old_web-specific historical docs.
- `js/` app logic, state, API, views, components.
- `pages/` HTML templates loaded dynamically for home/viewer view shells.
- `viewer/` legacy placeholder folder.

## API Endpoints Used
Configured in `js/config.js`:
- `GET /files`
- `POST /files/refresh`
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`

## Caching Layers
- API layer (`js/api/hdf5Service.js`): in-memory maps + LRU caches for files/tree/meta/preview/data windows.
- Runtime layer (`js/components/viewerPanel/shared.js`): shared caches for matrix blocks and line viewport state.

## Legacy / Placeholder Files
Some files/folders are intentionally empty and not part of active runtime:
- `js/router.js`
- `js/components/Component.js`, `js/components/HomePage.js`, `js/components/ViewerPage.js`
- `js/components/viewer/*`
- `js/utils/cache.js`, `js/utils/dom.js`, `js/utils/formatters.js`
- `js/visualizations/*`
- `viewer.html`, `viewer/index.html`

## Local Development
Because this is module-based frontend, serve it over HTTP (not file://).
Example from repository root:

```bash
python -m http.server 8080
```

Open:
- `http://localhost:8080/old_web/index.html`

Backend should also be running and reachable by `API_BASE_URL`.

## Configuring Backend URL
Set in `old_web/config/runtime-config.js` by defining:

```js
window.__CONFIG__ = {
  API_BASE_URL: "https://your-backend-host"
};
```

Without override, `js/config.js` falls back to default URL.
# old_web Frontend

This folder contains the current browser frontend for HDF Viewer, implemented with plain HTML, CSS, and ES modules.

## Runtime Entry

1. `old_web/index.html` loads the CSS stack.
2. `old_web/config/runtime-config.js` runs before modules and can inject `window.__CONFIG__.API_BASE_URL`.
3. `old_web/js/app.js` bootstraps state subscription, rendering, and initial file loading.

## Architecture Overview

- App shell and render loop: `old_web/js/app.js`
- State container: `old_web/js/state/store.js`
- Action composition: `old_web/js/state/reducers.js`
- API layer and response normalization: `old_web/js/api/*`
- Views: `old_web/js/views/homeView.js`, `old_web/js/views/viewerView.js`
- Viewer panel rendering and runtime behavior: `old_web/js/components/viewerPanel/*`
- Global and page styles: `old_web/css/*`
- HTML templates used by views: `old_web/pages/*`

## Main Runtime Flow

1. Home route loads file list via `actions.loadFiles()`.
2. Clicking `Open` calls `actions.openViewer(...)` and route switches to `viewer`.
3. Viewer sidebar lazily loads tree children through `actions.loadTreeChildren(path)`.
4. Dataset selection loads either metadata (inspect mode) or preview (display mode).
5. Full rendering modes are activated per tab:
   - Matrix full view: virtual block streaming
   - Line full view: interactive zoom and pan runtime
   - Heatmap full view: canvas runtime with zoom and tooltip

## Active Import Spine

- `old_web/js/app.js` imports:
  - `old_web/js/state/store.js`
  - `old_web/js/state/reducers.js`
  - `old_web/js/views/homeView.js`
  - `old_web/js/views/viewerView.js`
  - `old_web/js/components/topBar.js`
- `old_web/js/state/reducers.js` imports:
  - `old_web/js/api/hdf5Service.js`
  - `old_web/js/state/reducers/*.js`
- `old_web/js/views/viewerView.js` imports:
  - `old_web/js/components/sidebarTree.js`
  - `old_web/js/components/viewerPanel.js`
- `old_web/js/components/viewerPanel.js` re-exports:
  - `old_web/js/components/viewerPanel/render.js`
  - `old_web/js/components/viewerPanel/runtime.js`

## Folder Guide

- `old_web/assets/`: static assets
- `old_web/config/`: runtime config injection script
- `old_web/css/`: tokens and page/component styles
- `old_web/docs/`: old_web-specific architecture notes
- `old_web/js/`: application logic, views, state, API, runtimes
- `old_web/pages/`: HTML templates for home and viewer views
- `old_web/viewer/`: legacy placeholder route assets

## Placeholder and Legacy Files

The files below currently exist but are not part of the active runtime path:

- `old_web/viewer.html`
- `old_web/viewer/index.html`
- `old_web/js/router.js`
- `old_web/js/components/Component.js`
- `old_web/js/components/HomePage.js`
- `old_web/js/components/ViewerPage.js`
- `old_web/js/components/viewer/*`
- `old_web/js/visualizations/*`
- `old_web/js/utils/cache.js`
- `old_web/js/utils/dom.js`
- `old_web/js/utils/formatters.js`
- `old_web/css/common.css`

## Recommended Starting Points for New Developers

1. Read `old_web/js/app.js`.
2. Read `old_web/js/state/store.js` and `old_web/js/state/reducers.js`.
3. Read `old_web/js/views/viewerView.js`.
4. Read `old_web/js/components/viewerPanel/render/sections.js`.
5. Read `old_web/js/components/viewerPanel/runtime/bindEvents.js` and runtime modules.
