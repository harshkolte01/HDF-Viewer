# js/components/viewerPanel

Display/inspect panel rendering and runtime orchestration.

## What is implemented
- `shared.js`: shared constants and helpers for matrix, line, heatmap, and display config formatting.
- `render.js`: panel-level wrapper choosing display or inspect content.
- `runtime.js`: facade that binds runtime events/initializers.
- `render/`: builds toolbars, sections, preview content, and runtime shell markup.
- `runtime/`: full matrix/line/heatmap runtime behavior and cleanup management.

## How it is implemented
- Render modules output deterministic HTML with `data-*` hooks.
- Runtime modules locate those hooks and attach interaction logic, data loading, and export APIs.
- Cleanup registries ensure rerendering does not leak handlers from previous runtime shells.
