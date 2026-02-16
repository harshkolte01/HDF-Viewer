# js/components

Reusable UI components and viewer panel facade modules.

## Active Components

- `topBar.js`
  - Renders home top navbar and binds refresh button.
  - Imported by `old_web/js/app.js`.
- `tableView.js`
  - Renders file table rows for home page.
  - Imported by `old_web/js/views/homeView.js`.
- `sidebarTree.js`
  - Renders lazy sidebar tree and binds select/expand/retry events.
  - Imported by `old_web/js/views/viewerView.js`.
- `viewerPanel.js`
  - Facade that re-exports viewer panel renderer and runtime binder.
  - Imported by `old_web/js/views/viewerView.js`.

## Supporting Stubs

- `toolbar.js`: display/inspect toggle helper, not currently wired in active view.
- `lineChart.js`: renderer marker helper.
- `heatmap.js`: renderer marker helper.
- `dimensionControls.js`: minimal display-dims text block helper.

## Legacy Placeholder Files

- `Component.js` (empty)
- `HomePage.js` (empty)
- `ViewerPage.js` (empty)
- `viewer/` subfolder contains older component placeholders.
