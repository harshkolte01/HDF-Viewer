# css/components

Component-level style files loaded by `old_web/index.html`.

## Files

- `table.css`
  - Home file table (`.files-table`, `.go-btn`, row/column responsive behavior).
- `charts.css`
  - Shared chart surface utility (`.chart-surface`).
- `tree.css`
  - Compatibility stub only.
  - Actual tree/sidebar styles are implemented in `old_web/css/viewer.css`.

## Notes

- Keep tree-related updates in `viewer.css` to avoid split ownership.
- Keep table/chart utility classes here when they are reused by multiple views.
