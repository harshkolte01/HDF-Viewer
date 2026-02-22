# js

Application logic for `old_web`, organized as native ES modules.

## Entry Points

- `app.js`: active bootstrap, route render loop, lifecycle cleanup.
- `main.js`: thin wrapper importing `app.js`.
- `router.js`: legacy placeholder (unused in active runtime).

## Runtime Layers

- `api/`: HTTP client, response normalizers, frontend caching service.
- `state/`: global store and composed action creators.
- `views/`: route-level render and bind modules.
- `components/`: reusable UI modules and viewer panel facade.
- `utils/`: formatting, template loading, LRU, export helpers.
- `visualizations/`: legacy placeholder modules (inactive).

## Active Dependency Spine

- `app.js` -> `state/store.js`, `state/reducers.js`, `views/*`, `components/topBar.js`
- `state/reducers.js` -> reducer factories (`reducers/*`)
- `views/viewerView.js` -> `components/sidebarTree.js`, `components/viewerPanel.js`
- `components/viewerPanel.js` -> `components/viewerPanel/render.js`, `components/viewerPanel/runtime.js`
- runtime modules -> `api/hdf5Service.js`
- export helpers -> `utils/export.js`

## Current Feature Coverage

- Matrix/line/heatmap preview and full runtime views.
- Line compare mode with runtime overlay and legend.
- Export menu dispatch for tab-specific CSV/PNG actions.

## Export Architecture Summary

- Export menu UI and dispatch live in `views/viewerView.js`.
- Runtime-specific implementations live in:
- `components/viewerPanel/runtime/matrixRuntime.js`
- `components/viewerPanel/runtime/lineRuntime.js`
- `components/viewerPanel/runtime/heatmapRuntime.js`
- Shared helpers are in `utils/export.js`.
- Full CSV downloads call backend `/files/<key>/export/csv` via direct URL build (not via `hdf5Service`).

## Notes

- Query-string version suffixes (`?v=...`) are intentionally kept on selected imports to force cache refresh after runtime changes.
