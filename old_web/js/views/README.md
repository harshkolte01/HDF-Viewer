# js/views

Route-level rendering and event binding.

## Files

- `homeView.js`: home route rendering and interactions.
- `viewerView.js`: viewer route layout, top/sub bars, and route-level wiring.

## Viewer Binding Flow (`viewerView.js`)

`bindViewerViewEvents()` wires:
- sidebar open/close and backdrop controls
- breadcrumb navigation and mode/tab changes
- line/heatmap toolbar toggles in subbar
- export menu open/close and action dispatch
- delegation to:
- `bindSidebarTreeEvents()`
- `bindViewerPanelEvents()`

## Export UI Ownership

`viewerView.js` owns:
- tab-specific export menu options
- open/close menu state (`.is-open` class)
- action routing to runtime `shell.__exportApi`
- status fallback when full runtime is not loaded

## Compare Integration

- Compare validation is not implemented in views.
- Views delegate compare actions to state reducers and runtime modules.
- Compare chips/status in panel are rendered by viewerPanel render modules.
