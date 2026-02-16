# js/state/reducers

Modular action factories used by `old_web/js/state/reducers.js`.

## Files

- `utils.js`
  - Path, shape, dim, and fixed-index normalization and comparison helpers.
- `filesActions.js`
  - File list load/refresh, home-view actions, viewer route entry.
- `treeActions.js`
  - Tree expand/collapse, children fetch, breadcrumb and node selection behavior.
- `viewActions.js`
  - Display vs inspect mode, tab switching, notation/grid/colormap toggles, full-view enable actions.
- `displayConfigActions.js`
  - Staging and applying display dims/fixed indices with debounced preview reload.
- `dataActions.js`
  - Metadata and preview loading pipeline, request de-duplication, warm preview strategy.

## Composition

All factory outputs are merged in `old_web/js/state/reducers.js` into a single `actions` object.

## Dependencies

Each factory receives injected dependencies:

- `actions` (for cross-calls)
- `getState` and `setState`
- API methods from `old_web/js/api/hdf5Service.js`
- shared normalization helpers from `utils.js`
