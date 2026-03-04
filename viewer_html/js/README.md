# js

Plain-script runtime source for the viewer.

## What is implemented
- Namespace-first architecture under `window.HDFViewer`.
- API layer with normalized contracts and frontend cache/dedupe behavior.
- Global state store plus action-based reducer modules.
- Shell components, panel renderers, and full matrix/line/heatmap runtimes.
- Viewer orchestration and application bootstrap.

## How it is implemented
- Every file is an IIFE with dependency guards and namespace publishing (`core.ensurePath`).
- Load order in `index.html` enforces dependencies instead of ES module imports.
- Key exports are also bridged to `window.*` for compatibility with converted legacy callsites.
- Event handling is mostly delegated from stable roots to reduce rebind churn on rerender.

## Subsystems
- `core/`: namespace, config, DOM reference contract.
- `api/`: fetch client, payload normalization, HDF5 service.
- `state/`: store and action factories.
- `components/`: tree and viewer panel render/runtime logic.
- `views/`: shell orchestration and top-level UI event wiring.
- `app-viewer.js`: startup and lifecycle entrypoint.
