# pages

HTML templates loaded at runtime by `old_web/js/utils/templateLoader.js`.

## Files

- `home.html`
  - Placeholder slots: `{{HOME_STATS}}`, `{{HOME_CONTROLS}}`, `{{HOME_FILE_LIST}}`.
  - Used by `old_web/js/views/homeView.js`.
- `viewer.html`
  - Placeholder slots: `{{VIEWER_SIDEBAR}}`, `{{VIEWER_TOPBAR}}`, `{{VIEWER_SUBBAR}}`, `{{VIEWER_PANEL}}`.
  - Used by `old_web/js/views/viewerView.js`.

## Notes

- If template loading fails, both view modules have internal fallback template strings.
