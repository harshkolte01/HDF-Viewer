# js

Application logic for `old_web`, organized as ES modules.

## Entry Points

- `app.js`: active bootstrap, render loop, route switch, startup file load.
- `main.js`: thin wrapper importing `app.js`.
- `router.js`: legacy empty file (unused).

## Runtime Layers

- `api/`: HTTP client, payload normalization contracts, frontend caching service.
- `state/`: global store + composed action creators.
- `views/`: route-level renderers and event binders.
- `components/`: reusable UI modules and viewer panel facade.
- `utils/`: formatting, debounce, LRU cache, template loading.
- `visualizations/`: legacy placeholders (inactive).

## Active Dependency Spine

- `app.js` -> `state/store.js`, `state/reducers.js`, `views/*`, `components/topBar.js`
- `state/reducers.js` -> feature action factories including `reducers/compareActions.js`
- `views/viewerView.js` -> `components/sidebarTree.js`, `components/viewerPanel.js`
- `components/viewerPanel.js` -> `components/viewerPanel/render.js`, `components/viewerPanel/runtime.js`
- Runtime modules -> `api/hdf5Service.js` for `/data` requests

## Current Notable Behaviors

- Line compare V1 is fully frontend-managed state + runtime overlay.
- Tree only shows compare affordance for compatible datasets.
- Compare mode tree layout enables horizontal scrolling for long labels.

## Notes

- Query-string version suffixes (`?v=...`) remain on selected imports to force browser cache refresh after runtime fixes.
