# js/views

Route-level rendering and event binding.

## Files

- `homeView.js`
  - Loads `pages/home.html` template (fallback included in module).
  - Renders stats, search controls, file list, and empty/error states.
  - Binds retry/search/open-file events.
- `viewerView.js`
  - Loads `pages/viewer.html` template (fallback included in module).
  - Renders viewer top bar, breadcrumb, display toolbar, sidebar tree, and viewer panel.
  - Binds viewer actions (sidebar, mode, tabs, notation, grid/colormap, fullscreen).

## Imported By

- `old_web/js/app.js` imports both views for route rendering.

## Dependencies

- Uses `old_web/js/utils/templateLoader.js` for templates.
- Uses components from `old_web/js/components/*`.
