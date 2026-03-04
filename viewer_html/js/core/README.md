# js/core

Core runtime primitives required by all other viewer modules.

## What is implemented
- `namespace.js`: initializes `window.HDFViewer`, module registration, and dependency checks.
- `config.js`: resolves runtime API base URL and endpoint builders.
- `domRefs.js`: defines required shell IDs and shared DOM helper methods.

## How it is implemented
- `namespace.js` runs first and creates stable namespace paths.
- `config.js` reads `window.__CONFIG__`, normalizes base URL, and publishes endpoint helpers.
- `domRefs.js` enforces static-shell ID contract and provides small DOM utility helpers used by views.
