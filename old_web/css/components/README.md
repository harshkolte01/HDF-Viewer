# css/components

Component-level style files loaded by `old_web/index.html`.

## Files

- `table.css`
- Home file table styles (`.files-table`, `.go-btn`, responsive row behavior).
- `charts.css`
- Shared chart-surface utility (`.chart-surface`).
- `tree.css`
- Compatibility stub only.
- Active tree/sidebar styles (including compare controls) are in `old_web/css/viewer.css`.

## Ownership Rule

- Keep reusable table/chart utilities in this folder.
- Keep viewer tree and compare UX styling in `viewer.css` to avoid split ownership.
