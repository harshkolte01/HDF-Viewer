# pages

HTML templates loaded at runtime by `old_web/js/utils/templateLoader.js`.

## Files

- `home.html`
- Slots: `{{HOME_STATS}}`, `{{HOME_CONTROLS}}`, `{{HOME_FILE_LIST}}`
- Used by `old_web/js/views/homeView.js`
- `viewer.html`
- Slots: `{{VIEWER_SIDEBAR}}`, `{{VIEWER_TOPBAR}}`, `{{VIEWER_SUBBAR}}`, `{{VIEWER_PANEL}}`
- Used by `old_web/js/views/viewerView.js`

## Runtime Behavior

- Templates are fetched with `cache: "no-store"` and memoized in-memory by `templateLoader.js`.
- Both views keep fallback inline template strings if fetch fails.

## Compare UI Placement

- Line compare controls are injected inside `{{VIEWER_PANEL}}` by `viewerPanel/render/sections.js`.
- Tree compare buttons are injected inside `{{VIEWER_SIDEBAR}}` by `components/sidebarTree.js`.
