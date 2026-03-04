# js/state/reducers

Action factories that implement viewer behavior transitions.

## What is implemented
- `utils.js`: path and multidimensional config helper functions.
- `filesActions.js`: file list loading, open viewer, reset to blocked/home state.
- `treeActions.js`: lazy node loading, expand/collapse, breadcrumb and tree selection logic.
- `viewActions.js`: UI mode/tab/control toggles and full-view enable guards.
- `displayConfigActions.js`: staged/applied dimensions and fixed index updates with debounced preview reload.
- `dataActions.js`: metadata/preview fetch with request keying, stale response safety, and cache warming.
- `compareActions.js`: line compare validation and compare selection management.

## How it is implemented
- Each file exports `create*Actions(deps)`.
- Reducers rely on normalized helper math to keep display dims and fixed indices valid.
- Async actions check latest state before applying results to avoid stale-request overwrites.
