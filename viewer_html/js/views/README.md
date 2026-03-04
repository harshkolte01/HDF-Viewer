# js/views

Top-level shell rendering and user interaction orchestration.

## What is implemented
- `viewerView.js` manages static shell regions (sidebar, topbar, subbar, display/inspect panes, status surfaces).
- Delegated event handling for mode changes, tabs, breadcrumbs, sidebar controls, fullscreen, and exports.
- Export menu routing to runtime-provided `__exportApi` handlers.

## How it is implemented
- The view validates required DOM IDs through `core/domRefs` before rendering.
- UI updates are applied by region, not by replacing the full page shell.
- Status messages are synchronized from state for tree, display, inspect, and global surfaces.
- Runtime and tree event binders are called after each render to attach behavior to current shells.
