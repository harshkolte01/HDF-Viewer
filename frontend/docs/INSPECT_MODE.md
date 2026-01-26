# Inspect Mode Metadata

Date: 2026-01-26
Status: Complete
Type: Frontend UI Behavior

## Overview

Updated the viewer so metadata is only shown when the Inspect toggle is active. Display mode now keeps the right panel focused on visualization messaging without metadata calls.

## Changes

- Added view mode state to control Display vs Inspect.
- Metadata fetch runs only in Inspect mode.
- Viewer panel content switches based on the active mode.

## Files Updated

- c:\Coding\HDF Viewer\frontend\src\pages\ViewerPage.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\TopBar.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\ViewerPanel.jsx
