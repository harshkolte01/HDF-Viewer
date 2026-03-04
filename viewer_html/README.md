# viewer_html

Viewer-only, plain-script HDF5 frontend built around a static ID-based HTML shell.

## What is implemented
- Single entrypoint at `index.html` with a permanent shell (`viewer-app`, `viewer-sidebar`, `viewer-panel`, status regions, and mobile backdrop controls).
- Full viewer behavior parity for tree navigation, inspect metadata, display previews, and full matrix/line/heatmap runtimes.
- Non-module JavaScript architecture (`window.HDFViewer`) with strict script load order and runtime dependency checks.
- Deep-link contract using `?file=<object-key>` and optional `&bucket=<bucket-name>`.
- Export bridge support for displayed/full CSV and current PNG actions where runtime supports it.

## How it is implemented
- `index.html` loads CSS and JavaScript in deterministic order; every JS file is an IIFE that publishes to the namespace.
- `js/app-viewer.js` validates dependencies, wires state subscriptions, handles deep-link boot, and triggers rerender.
- `js/views/viewerView.js` updates fixed shell regions (no full-shell replacement) and delegates UI interactions.
- State/actions are centralized in `js/state`, API normalization/caching in `js/api`, and runtime rendering in `js/components/viewerPanel`.
- Matrix, line, and heatmap full views attach runtime-specific `__exportApi` handlers for the subbar export menu.

## Folder map
- `assets/`: static branding assets.
- `config/`: runtime config bootstrap.
- `css/`: tokens, shell layout, panel/runtime styles, and component-level CSS.
- `js/`: namespace/core, API, state/actions, components, view orchestration, and app boot.

## Boot flow (high level)
1. `config/runtime-config.js` creates `window.__CONFIG__`.
2. `js/core/*` initializes namespace/config/DOM references.
3. `js/api/*` and `js/state/*` prepare contracts, caching, and actions.
4. `js/components/*` renders shell content and binds runtime behavior.
5. `js/views/viewerView.js` and `js/app-viewer.js` render the app and handle user interaction.
