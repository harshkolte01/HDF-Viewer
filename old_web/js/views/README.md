# js/views

Route-level rendering and event binding.

## Files

- `homeView.js`
  - Loads `pages/home.html` template (with fallback template string).
  - Renders stats, controls, file table, loading/error/empty states.
  - Binds retry, search, and open-file events.
- `viewerView.js`
  - Loads `pages/viewer.html` template (with fallback template string).
  - Renders sidebar, breadcrumb top bar, display toolbar, and viewer panel.
  - Binds viewer route interactions and delegates to sidebar/panel binders.
  - Includes global viewer fullscreen button behavior.

## Event Binding Flow

- `app.js` calls `bindViewerViewEvents()` when route is `viewer`.
- `bindViewerViewEvents()` wires top-level controls, then calls:
  - `bindSidebarTreeEvents()`
  - `bindViewerPanelEvents()`
- On non-viewer route, cleanup runs through `clearViewerViewBindings()` and runtime cleanup in `app.js`.
