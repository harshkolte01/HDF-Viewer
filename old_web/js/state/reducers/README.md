# js/state/reducers

Modular action factories used by `old_web/js/state/reducers.js`.

## Files

- `utils.js`
  - Path normalization, dim/index normalization, equality helpers.
- `filesActions.js`
  - Home file list load/refresh and viewer route entry.
- `treeActions.js`
  - Tree expand/collapse/load and dataset/group selection behavior.
- `viewActions.js`
  - Display/inspect mode, tab switching, notation/grid/colormap, full-view enables.
- `displayConfigActions.js`
  - Stage/apply/reset display dims and fixed indices.
  - Debounced preview reload after applied config changes.
- `dataActions.js`
  - Metadata and preview loading pipeline.
  - Request de-duplication and warm-preview behavior (smaller first load, larger steady load).
- `compareActions.js`
  - Line compare mode toggle and selected comparison dataset management.
  - Eligibility validation (dataset type, numeric dtype, ndim/shape compatibility).

## Composition

`old_web/js/state/reducers.js` injects store/api/utils deps and merges all factory outputs into one `actions` object.

## Important Behavior

- Any dataset or tab context change resets full-view flags (`matrixFullEnabled`, `lineFullEnabled`, `heatmapFullEnabled`).
- Preview requests are keyed by selection + mode + display config + etag + max size + detail.
