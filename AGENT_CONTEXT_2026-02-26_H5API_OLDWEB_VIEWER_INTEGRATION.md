# AGENT CONTEXT — 2026-02-26 — H5API → old_web Viewer Integration

## Summary

Connected **H5API** (the MinIO file browser) to **old_web** (the HDF5 viewer SPA) so that
clicking **"Go"** on any `.h5` file in H5API immediately opens that file in the full HDF5
viewer — tree, metadata, preview, data — all powered by the **backend** API.

---

## System Overview (before & after)

### Three services involved

| Service | Dir | Port | Role |
|---|---|---|---|
| **H5API** | `H5API/` | 5100 | S3/MinIO folder-browser UI (lists bucket objects) |
| **backend** | `backend/` | 5000 | HDF5 data API — children, meta, preview, data |
| **old_web** | `old_web/` | static | SPA file browser + full HDF5 viewer |

All three services point at the **same MinIO bucket**. H5API and backend are completely
separate Flask apps — they share no code, only the same object storage.

### Before this session

```
H5API  ──  "Copy Path" button  →  copies key to clipboard  (dead end)

old_web  ──  lists /files from backend  ──  "Open" click  →  viewer (local state only)
           no URL param support — ?file= param silently ignored
```

### After this session

```
H5API  ──  "Go" button  →  opens  old_web/?file=<encoded-key>  [new tab]
                                       ↓
old_web  reads ?file= on bootstrap  →  actions.openViewer({ key })
                                       ↓
backend /files/<key>/children|meta|preview|data  →  full viewer
```

---

## Changes Made

### 1. `H5API/templates/index.html`

#### 1a. "Copy Path" → "Go" button

**CSS** — replaced `.copy-btn` (passive gray outline) with `.go-btn` (solid primary blue, lift on hover):

```css
/* REMOVED */
.copy-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-sec);
  ...
}

/* ADDED */
.go-btn {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  transition: background .14s, border-color .14s, transform .1s;
  ...
}
.go-btn:hover { background: var(--primary-hov); transform: translateY(-1px); }
```

**Button HTML** in the file table row (template string inside `render()`):

```html
<!-- BEFORE -->
<button class="copy-btn" onclick="copyPath('${esc(file.key)}')">
  <!-- copy icon --> Copy Path
</button>

<!-- AFTER -->
<button class="go-btn" onclick="goToFile('${esc(file.key)}')">
  <!-- arrow-right icon --> Go
</button>
```

**Table column header** — `"Path"` → `"Open"`.

#### 1b. `copyPath()` → `goToFile()`

```javascript
// REMOVED
function copyPath(key) {
  navigator.clipboard.writeText(key).then(() => { ... });
}

// ADDED
function goToFile(key) {
  const url = `${VIEWER_BASE}/?file=${encodeURIComponent(key)}`;
  window.open(url, '_blank');
}
```

#### 1c. `VIEWER_BASE` constant added to config block

```javascript
// ADDED — configurable base URL for the old_web viewer
const VIEWER_BASE = (window.__VIEWER_BASE__ || 'http://localhost:3000').replace(/\/+$/, '');
```

- Default: `http://localhost:3000`
- Override at runtime by setting `window.__VIEWER_BASE__` before the `<script>` tag

---

### 2. `old_web/js/app.js`

**File:** `old_web/js/app.js`  
**Function:** `bootstrapApp()`  

Added `?file=` deep-link handling — the only missing link that prevented the "Go" button
from landing in the viewer.

#### What was added (diff-style)

```javascript
async function bootstrapApp() {
  await Promise.allSettled([initHomeViewTemplate(), initViewerViewTemplate()]);
  subscribe(queueRender);

  const mql = window.matchMedia("(max-width: 1024px)");
  function handleViewportChange(e) { actions.setSidebarOpen(!e.matches); }
  mql.addEventListener("change", handleViewportChange);
  if (mql.matches) { actions.setSidebarOpen(false); }

+ // Deep-link: H5API "Go" button passes ?file=<encoded-key>
+ const deepLinkKey = new URLSearchParams(location.search).get("file");

  renderApp();

- void actions.loadFiles();
+ // Always pre-load the file list so "back to home" works instantly.
+ void actions.loadFiles();

+ if (deepLinkKey) {
+   // Clean the URL bar — prevents re-opening same file on manual refresh.
+   history.replaceState({}, "", location.pathname);
+   // etag is null — H5API browse does not expose it; null is safe as a
+   // cache hint fallback.
+   actions.openViewer({ key: deepLinkKey, etag: null });
+ }
}
```

#### Why each line exists

| Line | Reason |
|---|---|
| `URLSearchParams.get("file")` | Reads the key H5API put in the URL; auto-decodes percent-encoding |
| `renderApp()` **before** `loadFiles` | Renders home/viewer shell without waiting for the file list |
| `history.replaceState(…, pathname)` | Strips `?file=` so a manual refresh doesn't re-open the same file |
| `actions.openViewer({ key, etag: null })` | Triggers the full state transition to viewer mode; `etag: null` is safe |
| `void actions.loadFiles()` stays | File list is still fetched in background so "back to home" works instantly |

---

## End-to-End Flow

```
1.  User opens H5API at http://localhost:5100
2.  H5API calls GET /api/browse?prefix= against MinIO
3.  User navigates folders and finds an .h5 file
4.  User clicks [Go]
        ↓
5.  goToFile("experiments/run1/data.h5") fires
6.  window.open("http://localhost:3000/?file=experiments%2Frun1%2Fdata.h5", "_blank")
        ↓
7.  old_web loads in new tab
8.  bootstrapApp() reads URLSearchParams → deepLinkKey = "experiments/run1/data.h5"
9.  history.replaceState cleans URL → "http://localhost:3000/"
10. actions.openViewer({ key: "experiments/run1/data.h5", etag: null })
        ↓
11. setState({ route: "viewer", selectedFile: "experiments/run1/data.h5", ... })
12. renderApp() renders the viewer shell
13. actions.loadTreeChildren("/") fires
        ↓
14. Backend: GET /files/experiments/run1/data.h5/children?path=/  → HDF5 tree
15. Backend: GET /files/experiments/run1/data.h5/preview?path=... → preview payload
16. Backend: GET /files/experiments/run1/data.h5/meta?path=...    → metadata
17. Backend: GET /files/experiments/run1/data.h5/data?path=...    → matrix/line data
        ↓
18. Full HDF5 viewer displayed with file tree, metadata panel, charts
```

---

## Files Changed

| File | Type | Nature of change |
|---|---|---|
| `H5API/templates/index.html` | Full rewrite of action column | CSS `.copy-btn` → `.go-btn`; `copyPath()` → `goToFile()`; `VIEWER_BASE` constant; header `"Path"` → `"Open"` |
| `old_web/js/app.js` | Additive (~13 lines) | `?file=` deep-link parsing + `history.replaceState` + `actions.openViewer` call in `bootstrapApp()` |

**No backend changes.** The backend already served all required endpoints by file key.  
**No H5API backend changes.** `app.py` `list_prefix()` already returned the `key` field needed.

---

## Configuration Reference

### H5API — `VIEWER_BASE`

Set `window.__VIEWER_BASE__` in a config block before H5API's `<script>` tag:

```html
<script>window.__VIEWER_BASE__ = 'https://your-oldweb-domain.com';</script>
```

Default: `http://localhost:3000`

### old_web — Backend URL

Set `window.__CONFIG__.API_BASE_URL` in `old_web/config/runtime-config.js`:

```javascript
window.__CONFIG__ = { API_BASE_URL: 'http://localhost:5000' };
```

Default: `https://hdf-viewer-backend.vercel.app` (Vercel production)

### Running all three locally

```bash
# Terminal 1 — backend (HDF5 data API)
cd backend
python app.py          # → http://localhost:5000

# Terminal 2 — H5API (MinIO browser)
cd H5API
python app.py          # → http://localhost:5100

# Terminal 3 — old_web (viewer SPA)
cd old_web
python -m http.server 3000   # → http://localhost:3000
```

Then update `old_web/config/runtime-config.js` to point at `localhost:5000` for local backend.

---

## Key Design Decisions

1. **`?file=` is consumed immediately and cleaned** — `history.replaceState` prevents stale
   deep-links on manual refresh while preserving correct browser back-navigation behaviour.

2. **`etag: null` is intentional** — H5API's `/api/browse` response does not include the
   S3 ETag for files. The viewer uses `etag` only as an optional cache-busting hint;
   `null` means no caching optimisation, which is safe and correct.

3. **`loadFiles()` still fires** — even when a deep-link opens the viewer directly, the
   home-page file list is fetched in the background so the user can navigate back to home
   without a loading delay.

4. **No backend changes needed** — the backend endpoints (`/files/<key>/…`) already accept
   the same S3 object key format that H5API exposes in its `files[].key` field, because
   both services read from the same MinIO bucket with the same key structure.

5. **`window.__VIEWER_BASE__` override** — makes H5API deployable in any environment
   (stage, prod, custom domain) without touching source code.
