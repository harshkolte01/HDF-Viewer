# css/components

Component-level style files loaded by `old_web/index.html`.

## Files

- `table.css`: home file table styles (`.files-table`, action buttons, responsive row handling).
- `charts.css`: shared chart-surface utility class.
- `tree.css`: compatibility stub.

## Ownership Rule

- Keep reusable table/chart utility styles in this folder.
- Keep active viewer tree, compare, and export UI styling in `old_web/css/viewer.css`.

## Why `tree.css` Is Minimal

The active sidebar tree implementation (including compare mode horizontal scroll and compare button states) is fully owned by `viewer.css` to avoid split ownership.
