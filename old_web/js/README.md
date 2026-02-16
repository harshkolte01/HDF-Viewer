# js

Application logic for old_web, organized as ES modules.

## Entry Points

- `app.js`: active bootstrap and render loop.
- `main.js`: tiny wrapper that imports `app.js`.
- `router.js`: legacy placeholder, currently empty.

## Runtime Layers

- `api/`: HTTP client, contracts, and frontend caching service.
- `state/`: global store plus action factories.
- `views/`: route-level UI rendering and event binding.
- `components/`: reusable UI and viewer panel modules.
- `utils/`: formatting, template loading, debounce, LRU cache.
- `visualizations/`: legacy placeholder visual modules.

## Core Dependency Flow

- `app.js` -> `state/store.js`, `state/reducers.js`, `views/*`, `components/topBar.js`
- `state/reducers.js` -> `api/hdf5Service.js` + `state/reducers/*`
- `views/viewerView.js` -> `components/sidebarTree.js` + `components/viewerPanel.js`
- `components/viewerPanel.js` -> `components/viewerPanel/render.js` + `components/viewerPanel/runtime.js`
- runtime modules -> `api/hdf5Service.js` for `/data` fetches

## Notes

- Query-parameter cache busting (`?v=...`) is intentionally used on some imports to control browser cache.
