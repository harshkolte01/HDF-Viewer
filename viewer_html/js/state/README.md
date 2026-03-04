# js/state

Application state container and action composition for viewer behavior.

## What is implemented
- `store.js`: shared mutable state object plus `getState`, `setState`, and `subscribe`.
- `reducers.js`: merges all action factories into a single `actions` API.
- `reducers/`: feature-specific action modules (files, tree, view, display config, data, compare).

## How it is implemented
- State is a single object with route/file selection, tree cache, metadata/preview state, display options, runtime flags, and compare state.
- Action modules receive shared dependencies (`getState`, `setState`, API methods, reducer utils).
- Boot and views call `actions.*`; updates fan out through `subscribe` to rerender the shell.
