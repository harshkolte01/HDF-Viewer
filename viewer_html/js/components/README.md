# js/components

UI component layer for tree and viewer panel behavior.

## What is implemented
- `sidebarTree.js`: renders the file tree and handles toggle/select/retry/compare-add interactions.
- `viewerPanel.js`: facade that delegates rendering and runtime binding to viewerPanel submodules.
- `viewerPanel/`: full panel rendering and runtime engine for matrix, line, and heatmap.

## How it is implemented
- Tree markup is regenerated from state and events are delegated from a stable root.
- Compare controls are conditionally rendered for compatible datasets in line compare mode.
- Panel facade keeps a stable API surface for view orchestration while internal modules evolve.
