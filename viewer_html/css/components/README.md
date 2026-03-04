# css/components

Component-scoped stylesheet files used by the viewer and list UIs.

## What is implemented
- `tree.css`: shim (tree visuals are centralized in `viewer.css`).
- `table.css`: table/list visuals for file rows and actions.
- `charts.css`: minimal shared chart surface style.

## How it is implemented
- This folder keeps component CSS entrypoints explicit even when canonical rules are merged elsewhere.
- Viewer runtime components still use these files in load order for compatibility with old_web structure.
