# Home to Viewer Flow

Date: 2026-01-26
Status: Complete
Type: Frontend UI + Navigation

## Overview

Restored the home landing page that lists HDF5 files with refresh and search, and added a simple navigation flow so selecting a file opens the viewer with live tree + metadata fetched from the API.

## What Changed

- Home page lists files with Sr No, file name, size, and Open button.
- App switches between Home and Viewer based on selected file.
- Viewer sidebar loads HDF5 children dynamically from `/files/{key}/children`.
- Viewer panel fetches metadata from `/files/{key}/meta` for the selected path.

## Files Updated

- c:\Coding\HDF Viewer\frontend\src\App.jsx
- c:\Coding\HDF Viewer\frontend\src\pages\HomePage.jsx
- c:\Coding\HDF Viewer\frontend\src\pages\ViewerPage.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\SidebarTree.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\TopBar.jsx
- c:\Coding\HDF Viewer\frontend\src\components\viewer\ViewerPanel.jsx
- c:\Coding\HDF Viewer\frontend\src\pages\ViewerPage.css
