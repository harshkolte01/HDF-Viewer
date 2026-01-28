# Viewer Notation + Axis Controls

Date: 2026-01-27
Status: Complete
Type: Frontend UI

## Overview

Added notation toggles (Auto / Scientific / Exact) and axis selectors (D0/D1) for 2D previews. Removed the stats cards from the preview panel.

## Behavior

- Notation controls live in the display toolbar and format table + line values.
- Axis toggles appear for 2D datasets and swap X/Y dims (D0/D1), re-fetching `/preview` with updated display dims.
- Stats cards are no longer shown in the preview panel.

## Files Updated

- `frontend/src/components/viewer/PreviewToolbar.jsx`
- `frontend/src/components/viewer/ViewerPanel.jsx`
- `frontend/src/components/viewer/ViewerPanel.css`
- `frontend/src/pages/ViewerPage.jsx`
- `frontend/src/pages/ViewerPage.css`
