# js/state/reducers

Modular action factories composed by `old_web/js/state/reducers.js`.

## Files

- `utils.js`: normalization and helper utilities.
- `filesActions.js`: file list load/refresh and route entry actions.
- `treeActions.js`: tree expand/collapse/load/select behavior.
- `viewActions.js`: display/inspect mode, tabs, notation/grid/aspect/colormap, full-view toggles.
- `displayConfigActions.js`: stage/apply/reset for dims and fixed indices.
- `dataActions.js`: metadata and preview loading pipeline.
- `compareActions.js`: line compare mode and candidate validation.

## Compare Action API (`compareActions.js`)

- `toggleLineCompare(value?)`
- `clearLineCompare()`
- `removeLineCompareDataset(path)`
- `dismissLineCompareStatus()`
- `addLineCompareDataset(candidate)`

## Compare Eligibility Rules

- dataset node only
- valid normalized path
- candidate path must differ from base path
- numeric dtype for base and candidate
- same `ndim`
- same `shape`
- maximum 4 compare datasets

## Behavior Notes

- Tab/context changes reset full-view enable flags (`matrixFullEnabled`, `lineFullEnabled`, `heatmapFullEnabled`).
- Compare status messages are emitted via `lineCompareStatus` for user feedback.
- Export has no reducer actions; runtime modules handle export directly.
