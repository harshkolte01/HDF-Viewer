# js/views

Route-level rendering and event binding.

## Files

- `homeView.js`
- Loads `pages/home.html` template (with fallback string).
- Renders stats, controls, and file list states.
- Binds retry/search/open-file interactions.
- `viewerView.js`
- Loads `pages/viewer.html` template (with fallback string).
- Renders sidebar, breadcrumb/top bars, toolbar, and viewer panel.
- Binds viewer route interactions and delegates to sidebar/panel binders.
- Includes global viewer fullscreen button behavior.

## Event Binding Flow

- `app.js` calls `bindViewerViewEvents()` when route is `viewer`.
- `bindViewerViewEvents()` wires top-level controls, then calls:
- `bindSidebarTreeEvents()`
- `bindViewerPanelEvents()`
- On non-viewer route, cleanup runs via `clearViewerViewBindings()` and runtime cleanup in `app.js`.

## Compare Mode Integration

- Compare UX is rendered through sidebar/panel components.
- Views do not own compare validation logic; they delegate to state actions and runtime modules.
