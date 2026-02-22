# js/components

Reusable UI components and viewer-panel facade modules.

## Active Components

- `topBar.js`: home top bar controls.
- `tableView.js`: home file table renderer.
- `sidebarTree.js`: viewer tree render and interactions.
- `viewerPanel.js`: facade re-export for viewer panel render/runtime entrypoints.

## `sidebarTree.js` Current Responsibilities

- Lazy tree rendering for groups/datasets.
- Expand/collapse and select wiring.
- Compare mode tree behavior:
- shows compare button only for compatible datasets
- marks base as `Base` and selected compare items as `Added`
- enables horizontal scroll mode for long names while compare is active

## Compatibility Helpers (Not Main Render Path)

- `toolbar.js`: old helper module.
- `lineChart.js`: legacy renderer marker helper.
- `heatmap.js`: legacy renderer marker helper.
- `dimensionControls.js`: superseded by viewerPanel render modules.

## Legacy Placeholders

- `Component.js`
- `HomePage.js`
- `ViewerPage.js`
- `viewer/*` modules

These are retained for compatibility and are not part of the active route runtime.
