# js/state/reducers

Modular action factories composed by `old_web/js/state/reducers.js`.

## Files

- `utils.js`
- Path normalization, dim/index normalization, equality helpers.
- `filesActions.js`
- Home file list load/refresh and viewer route entry.
- Includes compare-state resets on route/file context transitions.
- `treeActions.js`
- Tree expand/collapse/load and dataset/group selection behavior.
- Includes compare-state cleanup when base context changes.
- `viewActions.js`
- Display/inspect mode, tab switching, notation/grid/colormap, full-view enables.
- `displayConfigActions.js`
- Stage/apply/reset display dims and fixed indices.
- Debounced preview reload after applied config changes.
- `dataActions.js`
- Metadata + preview loading pipeline.
- Request de-dup and warm-preview behavior.
- `compareActions.js`
- Line compare mode state transitions and candidate validation.
- Public actions:
- `toggleLineCompare(value?)`
- `clearLineCompare()`
- `removeLineCompareDataset(path)`
- `dismissLineCompareStatus()`
- `addLineCompareDataset(candidate)`

## Compare Eligibility Rules (`compareActions.js`)

- Dataset node only.
- Valid normalized path.
- Candidate path cannot equal base path.
- Numeric dtype required for base and candidate.
- Same `ndim`.
- Same `shape`.
- Max compare items: 4.

## Composition

`old_web/js/state/reducers.js` injects store/api/utils deps and merges all factory outputs into one `actions` object.

## Important Behavior

- Dataset/tab context changes reset full-view flags (`matrixFullEnabled`, `lineFullEnabled`, `heatmapFullEnabled`).
- Preview requests are keyed by selection + mode + display config + etag + max size + detail.
- Compare failures and confirmations are emitted via `lineCompareStatus` for UI feedback.
