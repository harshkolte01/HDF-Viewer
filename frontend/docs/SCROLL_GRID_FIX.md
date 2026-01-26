# Viewer Scroll Grid Fix (2026-01-26)

Changes
- Constrained the viewer grid row to prevent page-level scrolling.
- Ensured the main column clips overflow so only the panel content scrolls.

Implementation
- `frontend/src/pages/ViewerPage.css`: `grid-template-rows: minmax(0, 1fr)` on `.viewer-page`.
- `frontend/src/pages/ViewerPage.css`: `overflow: hidden` on `.viewer-main`.
