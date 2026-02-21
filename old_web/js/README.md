# js

Application logic for `old_web`, organized as ES modules.

## Entry Points

- `app.js`: active bootstrap, render loop, route switch, and startup file load.
- `main.js`: tiny wrapper importing `app.js`.
- `router.js`: legacy empty file (not used).

## Runtime Layers

- `api/`: HTTP client, payload normalization contracts, frontend caching service.
- `state/`: store + composed action creators.
- `views/`: route-level renderers and event binders.
- `components/`: reusable UI modules and viewer panel facade.
- `utils/`: formatting, debounce, LRU cache, template loading.
- `visualizations/`: legacy placeholders (inactive).

## Active Dependency Spine

- `app.js` -> `state/store.js`, `state/reducers.js`, `views/*`, `components/topBar.js`
- `views/viewerView.js` -> `components/sidebarTree.js`, `components/viewerPanel.js`
- `components/viewerPanel.js` -> `components/viewerPanel/render.js`, `components/viewerPanel/runtime.js`
- Runtime modules -> `api/hdf5Service.js` for `/data` requests

## Notes

- Query-string version suffixes (`?v=...`) are intentionally used on some imports to force browser cache refresh after runtime fixes.
