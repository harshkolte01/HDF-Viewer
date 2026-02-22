# pages

HTML templates loaded by `old_web/js/utils/templateLoader.js`.

## Files

- `home.html`
- `viewer.html`

## Template Slots

`home.html`:
- `{{HOME_STATS}}`
- `{{HOME_CONTROLS}}`
- `{{HOME_FILE_LIST}}`

`viewer.html`:
- `{{VIEWER_SIDEBAR}}`
- `{{VIEWER_TOPBAR}}`
- `{{VIEWER_SUBBAR}}`
- `{{VIEWER_PANEL}}`

## Runtime Behavior

- Templates are fetched with `cache: "no-store"` and memoized in-memory.
- `homeView.js` and `viewerView.js` both include inline fallback templates.

## Compare and Export Placement

- Tree compare controls are rendered inside `{{VIEWER_SIDEBAR}}` by `js/components/sidebarTree.js`.
- Line compare chips/status and full chart shells are rendered inside `{{VIEWER_PANEL}}` by `js/components/viewerPanel/render/sections.js`.
- Export menu is rendered in the subbar by `js/views/viewerView.js` (not stored in static HTML templates).
