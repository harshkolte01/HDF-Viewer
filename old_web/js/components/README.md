# js/components

Reusable UI components and viewer-panel facade modules.

## Active Components

- `topBar.js`
  - Home navbar and refresh button binding.
- `tableView.js`
  - Home file table renderer.
- `sidebarTree.js`
  - Viewer tree renderer + expand/select/retry event wiring.
- `viewerPanel.js`
  - Facade re-export for panel render/runtime modules.

## Compatibility Helpers (Not in Main Render Path)

- `toolbar.js`: old mode toggle helper.
- `lineChart.js`: renderer marker helper (`svg`).
- `heatmap.js`: renderer marker helper (`canvas`).
- `dimensionControls.js`: minimal helper superseded by viewerPanel render module.

## Legacy Placeholders

- `Component.js` (empty)
- `HomePage.js` (empty)
- `ViewerPage.js` (empty)
- `viewer/*` (legacy viewer module placeholders)

## Main Imports

- `old_web/js/app.js` imports `topBar.js`.
- `old_web/js/views/homeView.js` imports `tableView.js`.
- `old_web/js/views/viewerView.js` imports `sidebarTree.js` and `viewerPanel.js`.
