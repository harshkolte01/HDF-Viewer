# js/state

Global state container and action composition for `old_web`.

## Files

- `store.js`
  - Mutable singleton `state` object.
  - `getState`, `setState`, `subscribe`.
- `reducers.js`
  - Dependency injection root.
  - Composes all reducer factories into exported `actions` object.
- `reducers/`
  - Feature-specific action factory modules.

## Runtime Responsibilities

- Route state (`home` / `viewer`).
- File list and refresh status.
- Tree expansion/loading/error maps.
- Selection and metadata lifecycle.
- Preview lifecycle + full-view enable flags.
- Display config staging/applied values for dimensions and fixed indices.
- Viewer UI settings (notation, line grid/aspect, heatmap grid/colormap, sidebar open).

## How It Is Used

- `old_web/js/app.js` subscribes to state changes and triggers rerender.
- View and runtime modules call `actions.*` methods for all mutations.
