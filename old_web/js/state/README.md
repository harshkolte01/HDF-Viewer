# js/state

Global state container and action composition for `old_web`.

## Files

- `store.js`: singleton state, `getState`, `setState`, `subscribe`.
- `reducers.js`: dependency-injected action composition root.
- `reducers/`: feature action factory modules.

## Runtime Responsibilities

- Route state (`home` / `viewer`).
- File list load/refresh status.
- Tree expansion/loading/error maps.
- Selected file/path/node metadata.
- Preview lifecycle and full-view enable flags.
- Display config (`displayDims`, `fixedIndices`) staging and apply.
- Viewer preferences (notation, grid/aspect/colormap, sidebar open).
- Line compare state:
- `lineCompareEnabled`
- `lineCompareItems`
- `lineCompareStatus`

## Compare State Lifecycle

- Compare state resets on route/file transitions where base context changes.
- Compare list can be pruned when selected context becomes invalid.
- Add/remove/clear/dismiss actions are managed in `reducers/compareActions.js`.

## Export State Note

- Export has no dedicated persistent store keys.
- Export execution is runtime-local and triggered from viewer view events.
- User feedback is written to existing status fields in panel sections.
