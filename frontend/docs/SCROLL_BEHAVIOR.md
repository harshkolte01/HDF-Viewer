# Scroll Behavior Update (2026-01-26)

Changes
- Added independent scrolling for the left tree and the inspect/main panel.

Implementation
- `frontend/src/pages/ViewerPage.css`: lock the viewer page to `100vh` and hide outer overflow so only inner panels scroll.
- `frontend/src/pages/ViewerPage.css`: make sidebar and panel flex children shrink with `min-height: 0`.
- `frontend/src/components/viewer/SidebarTree.jsx`: wrapped the tree list in `.sidebar-tree` to enable dedicated scroll.
- `frontend/src/pages/ViewerPage.css`: `.sidebar-tree` uses `overflow-y: auto` for the tree list.
- Mobile breakpoint keeps normal page scrolling by resetting `height` and `overflow`.
