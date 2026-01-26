# Viewer Page Layout

Date: 2026-01-26
Status: Complete
Type: Frontend UI

## Overview

Built a new viewer page layout with three components: a left sidebar tree, a top bar with file location and display/inspect actions, and a right content panel.

## Components

- SidebarTree: left navigation with a tree structure and file badge.
- TopBar: breadcrumb-style file location with segmented Display/Inspect actions.
- ViewerPanel: right-side content area with a placeholder state.

## Layout Notes

- Two-column grid: fixed sidebar and flexible main panel.
- Sticky top bar to keep context visible during scrolling.
- Uses theme tokens from AGENTS.md only.

## Files Added

- c:\Coding\HDF Viewer\frontend\src\components\viewer\SidebarTree.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\TopBar.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\ViewerPanel.jsx
- c:\Coding\HDF Viewer\frontend\src\pages\ViewerPage.jsx
- c:\Coding\HDF Viewer\frontend\src\pages\ViewerPage.css
