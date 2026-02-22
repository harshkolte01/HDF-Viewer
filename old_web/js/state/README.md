# js/state

Global state container and action composition for `old_web`.

## Files

- `store.js`
- Mutable singleton `state` object.
- Exposes `getState`, `setState`, `subscribe`.
- `reducers.js`
- Dependency-injection root.
- Composes all reducer factories into exported `actions` object.
- `reducers/`
- Feature-specific action factory modules.

## Runtime Responsibilities

- Route state (`home` / `viewer`).
- File list + refresh status.
- Tree expansion/loading/error maps.
- Selection and metadata lifecycle.
- Preview lifecycle + full-view enable flags.
- Display config staging/applied values (dims + fixed indices).
- Viewer settings (notation, line/heatmap grid/aspect/colormap, sidebar open).
- Line compare state:
- `lineCompareEnabled`
- `lineCompareItems`
- `lineCompareStatus`

## Compare State Lifecycle

- Compare state resets when entering viewer/home from file actions.
- Compare list/status is pruned or cleared when tree selection context no longer matches base dataset.
- Add/remove/clear/dismiss operations are handled by `reducers/compareActions.js`.

## How It Is Used

- `old_web/js/app.js` subscribes to state changes and triggers rerender.
- View and runtime modules call `actions.*` methods for all mutations.
