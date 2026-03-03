# OLD_WEB Viewer-Only Setup Guide
Date: 2026-03-03

## Goal
Show only the viewer page from `old_web` inside another project repository.

## Important Reality
- `old_web/viewer.html` and `old_web/viewer/index.html` are only redirects.
- Real app boot is `old_web/index.html` -> `old_web/js/app.js`.
- Viewer-only open is done by deep-link query params: `?file=<encoded-key>&bucket=<bucket>`.

## Step 1: Copy the Viewer Frontend into Your Target Repo
Use a static folder in your target repo, for example `public/hdf-viewer`.

PowerShell example (run from this repo root):

```powershell
robocopy old_web C:\path\to\target-repo\public\hdf-viewer /E /XD docs viewer /XF README.md viewer.html
```

This gives you the active runtime files:
- `index.html`
- `config/runtime-config.js`
- `css/**`
- `js/**`
- `pages/**`
- `assets/**`

## Step 2: Point to the Correct Backend
Edit copied file:
- `public/hdf-viewer/config/runtime-config.js`

Set:

```js
window.__CONFIG__ = window.__CONFIG__ || {};
window.__CONFIG__.API_BASE_URL = "https://your-backend-base-url";
```

`old_web` expects backend endpoints:
- `GET /files`
- `POST /files/refresh`
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`
- `GET /files/<key>/export/csv`

## Step 3: Open Viewer Directly (No Home Page)
Always open with `file` query param:

```text
/hdf-viewer/index.html?file=<url-encoded-object-key>
```

With bucket (if needed):

```text
/hdf-viewer/index.html?file=<url-encoded-object-key>&bucket=<bucket-name>
```

Example:

```text
/hdf-viewer/index.html?file=Folder_1%2Frandom_05.h5&bucket=hdf5files2
```

## Step 4: Build Deep-Link from Host App
Use this in your host app button/link:

```js
const viewerUrl =
  `/hdf-viewer/index.html?file=${encodeURIComponent(fileKey)}` +
  (bucket ? `&bucket=${encodeURIComponent(bucket)}` : "");
window.location.href = viewerUrl;
```

## Notes
- If `file` is missing, app starts in home route.
- You do not need to open `viewer.html`; use `index.html` deep-link.
- Keep `pages/home.html` in copied files even for viewer-only usage, because app bootstrap initializes both templates.
