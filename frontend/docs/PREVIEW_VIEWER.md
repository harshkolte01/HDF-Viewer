# Preview Viewer (Display Mode)

Date: 2026-01-27
Status: In progress
Type: Frontend UI

## Overview

Added a display-mode preview viewer that consumes the `/preview` endpoint and renders table, line, and heatmap views with dimension controls for nD datasets.

## UI Changes

- Added a second top bar (toolbar) with Matrix, Line Graph, Heatmap, and Export buttons.
- Matrix/Line/Heatmap toggle the active display tab.
- Heatmap button only appears for datasets with ndim >= 2.

## Display Mode Flow

1. When a dataset is selected and Display mode is active, the UI calls:
   - `GET /files/<key>/preview?path=...`
2. The preview payload drives:
   - Table view (1D or 2D sample)
   - Line view (1D line or 2D/ND profile)
   - Heatmap view (2D plane for 2D/ND)

## Dimension Controls (nD)

- For ndim > 2:
  - Two dropdowns choose display dims.
  - Sliders + number inputs set fixed indices for non-display dims.
  - Changing either re-fetches `/preview` with `display_dims` and `fixed_indices`.

## Files Updated

- `frontend/src/api/config.js` (added FILE_PREVIEW)
- `frontend/src/api/hdf5Service.js` (added getFilePreview)
- `frontend/src/api/index.js` (re-exported getFilePreview)
- `frontend/src/components/viewer/PreviewToolbar.jsx`
- `frontend/src/pages/ViewerPage.jsx` (preview state + fetch flow)
- `frontend/src/pages/ViewerPage.css` (subbar styling)
- `frontend/src/components/viewer/ViewerPanel.jsx` (preview UI)
- `frontend/src/components/viewer/ViewerPanel.css` (preview styling)

## Notes

- Inspect mode continues using `/meta`.
- Display mode uses `/preview` only.
- Export button is visual only for now.
