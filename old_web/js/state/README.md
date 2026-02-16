# js/state

Global state management for old_web.

## Files

- `store.js`
  - Holds a single mutable `state` object.
  - Exposes `getState`, `setState`, `subscribe`.
- `reducers.js`
  - Composes all action factories into one exported `actions` object.
  - Injects dependencies (`api`, store helpers, reducer utils).
- `reducers/`
  - Feature-specific action modules and shared reducer utilities.

## Imported By

- `old_web/js/app.js` imports `getState` and `subscribe`, plus `actions`.
- View and runtime event handlers call `actions.*` methods.

## Action Factory Groups

- File and route actions
- Tree actions
- View mode and toolbar actions
- Display config actions
- Data loading actions (metadata and preview)
