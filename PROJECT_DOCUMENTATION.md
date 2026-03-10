# HDF Viewer — Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [What is HDF5?](#2-what-is-hdf5)
3. [System Architecture](#3-system-architecture)
4. [Components](#4-components)
   - 4.1 [Backend (`backend/`)](#41-backend-backend)
   - 4.2 [Frontend UI (`old_web/`)](#42-frontend-ui-old_web)
   - 4.3 [H5API (`H5API/`)](#43-h5api-h5api)
   - 4.4 [Backend FS Variant (`backend_2/`)](#44-backend-fs-variant-backend_2)
   - 4.5 [Frontend Next (`frontend/`)](#45-frontend-next-frontend)
5. [Features](#5-features)
   - 5.1 [File Browser](#51-file-browser)
   - 5.2 [HDF5 Tree Navigation](#52-hdf5-tree-navigation)
   - 5.3 [Inspect Mode](#53-inspect-mode)
   - 5.4 [Matrix / Table View](#54-matrix--table-view)
   - 5.5 [Line Graph View](#55-line-graph-view)
   - 5.6 [Heatmap View](#56-heatmap-view)
   - 5.7 [Line Compare](#57-line-compare)
   - 5.8 [Export](#58-export)
   - 5.9 [Dimension Controls](#59-dimension-controls)
   - 5.10 [Caching](#510-caching)
6. [Data Flow](#6-data-flow)
7. [API Reference](#7-api-reference)
8. [Storage Backends](#8-storage-backends)
9. [Configuration & Environment](#9-configuration--environment)
10. [Technology Stack Summary](#10-technology-stack-summary)
11. [Deployment Notes](#11-deployment-notes)

---

## 1. Project Overview

**HDF Viewer** is a full-stack web application for browsing, inspecting, and visualizing **HDF5 (Hierarchical Data Format version 5)** files stored in cloud-compatible object storage (MinIO or S3-compatible services). It enables users to explore large scientific, engineering, or research datasets directly in a browser — without downloading the files.

The system consists of:

- A **Python/Flask REST API** that reads HDF5 files from object storage on demand, with smart caching and lazy slicing to handle arbitrarily large files efficiently.
- A **vanilla JS single-page frontend** (no build step required) that provides an interactive dashboard for browsing, visualizing, and exporting HDF5 data.

The current production combination is `backend/` (API) and `old_web/` (UI). Additional variants exist for different storage backends and a React-based next-generation frontend.

---

## 2. What is HDF5?

HDF5 (Hierarchical Data Format 5) is a widely used binary file format for storing large, complex, multi-dimensional scientific and engineering datasets. An HDF5 file is internally organized like a filesystem:

- **Groups** — analogous to directories; contain other groups and datasets.
- **Datasets** — n-dimensional arrays of numeric or string data.
- **Attributes** — key-value metadata attached to groups or datasets.
- **Chunks & Compression** — datasets can be stored in chunks and compressed (gzip, LZF, SZIP, etc.).

HDF5 files commonly store sensor readings, simulation output, satellite imagery, financial time series, and machine learning datasets ranging from kilobytes to terabytes in size.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       User Browser                          │
│                  old_web/ (Vanilla JS SPA)                  │
│   File Browser │ Tree Panel │ Matrix │ Line │ Heatmap        │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTP REST (JSON / Streaming CSV)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API  (Flask / Python)                  │
│               backend/app.py  :5000                         │
│                                                             │
│   Routes:  /files/*  /files/<key>/children                  │
│            /files/<key>/meta   /files/<key>/preview         │
│            /files/<key>/data   /files/<key>/export/csv      │
│                                                             │
│   Cache Layer (TTL in-memory, thread-safe)                  │
│   HDF5Reader (h5py + numpy)                                 │
└──────────┬──────────────────────────────────────┬──────────┘
           │  boto3 (list / head / etag)           │  s3fs + h5py
           ▼                                       ▼
┌─────────────────────┐               ┌─────────────────────┐
│   MinIO / S3        │               │  HDF5 File Content  │
│   Object Storage    │◄──────────────│  (byte-range reads) │
│   (.h5 files)       │               └─────────────────────┘
└─────────────────────┘
```

**Key architectural properties:**

- The backend never loads an entire HDF5 file into memory. Reads are slice-based and bounded by configurable element limits.
- Byte-range HTTP reads via `s3fs` allow random access into HDF5 datasets stored in object storage without full file downloads.
- Multiple independent caches (files list, tree, preview, data) reduce latency for repeated navigation.
- The frontend is fully static — it can be served from any CDN or web server. No server-side rendering is required.

---

## 4. Components

### 4.1 Backend (`backend/`)

**Status:** Active production.  
**Language:** Python 3.x  
**Framework:** Flask 3.0.0

The primary REST API server. Connects to MinIO/S3 to list HDF5 files and exposes endpoints for hierarchical browsing, metadata inspection, data windowing, and CSV export.

```
backend/
  app.py                        # Flask app bootstrap, CORS, health, endpoint dashboard
  wsgi.py                       # WSGI entrypoint (Gunicorn etc.)
  requirements.txt              # Python dependency list
  templates/
    index.html                  # Interactive API endpoint dashboard (served at GET /)
  src/
    routes/
      files.py                  # GET /files/, POST /files/refresh
      hdf5.py                   # children, meta, preview, data, export routes
    readers/
      hdf5_reader.py            # Core HDF5 slicing and payload shaping
    storage/
      minio_client.py           # boto3 S3/MinIO wrapper
    utils/
      cache.py                  # Thread-safe TTL + LRU-eviction cache
  tests/
    test_files_routes.py
    test_hdf5_routes.py
  scripts/
    benchmark.py
    test_minio.py
    verify_range_requests.py
```

### 4.2 Frontend UI (`old_web/`)

**Status:** Active production.  
**Language:** HTML + CSS + Vanilla JavaScript (ES Modules)  
**Build step:** None — runs directly in browser from static files.

The main user-facing SPA. Provides file browsing, HDF5 tree navigation, metadata inspection, and interactive visualization (matrix table, line graph, heatmap).

```
old_web/
  index.html                    # Single entry point
  viewer.html                   # Redirect shim (deep links to index.html)
  config/
    runtime-config.js           # Injects window.__CONFIG__.API_BASE_URL at deploy time
  css/
    tokens.css                  # Design token definitions (colors, spacing)
    app.css / home.css / viewer.css / viewer-panel.css
    components/
      tree.css / table.css / charts.css
  pages/
    home.html / viewer.html     # Route templates fetched and injected at runtime
  js/
    app.js                      # SPA bootstrap, render loop, route switching
    config.js                   # API_BASE_URL, endpoint builders
    api/
      client.js                 # fetch wrapper, AbortController, ApiError
      contracts.js              # Backend response normalizers
      hdf5Service.js            # High-level service with frontend LRU caches
    state/
      store.js                  # Global singleton state object
      reducers.js               # Action root + action factories per domain
      reducers/                 # Domain-specific action modules
    views/
      homeView.js               # Home route - file list render + events
      viewerView.js             # Viewer route - shell render + export dispatch
    components/
      topBar.js                 # Header breadcrumb + navigation
      sidebarTree.js            # Lazy HDF5 tree + compare controls
      tableView.js              # Virtualized matrix table
      viewerPanel/              # Render + runtime split architecture
        render/                 # Markup generation (previews, sections, dimension controls)
        runtime/                # Live interaction (matrixRuntime, lineRuntime, heatmapRuntime)
    utils/
      format.js                 # Bytes, numbers, dates formatting
      lru.js                    # LRU cache implementation
      debounce.js               # Debounce utility
      templateLoader.js         # Runtime HTML template fetching
      export.js                 # CSV/PNG export utilities
```

### 4.3 H5API (`H5API/`)

**Status:** Standalone prototype / companion tool.  
**Language:** Python (Flask)  
**Purpose:** Lightweight microservice providing a single-page file browser UI.

A simpler, self-contained Flask app that connects to MinIO/S3 and serves a client-side HTML file browser. It uses S3's virtual folder delimiter for native folder navigation without extra metadata. Does not implement the full HDF5 reading pipeline — it is primarily a file listing and navigation tool.

### 4.4 Backend FS Variant (`backend_2/`)

**Status:** Alternative backend implementation.  
**Language:** Python (Flask)  
**Storage:** Local or network filesystem (not S3/MinIO)

A variant of the main backend that reads HDF5 files from a local or network filesystem path rather than object storage. Shares the same route surface and API contract as `backend/`, making it a drop-in backend replacement for on-premise or file-server deployments. Configured via `STORAGE_PATH_LINUX` or `STORAGE_PATH_WINDOWS` environment variables.

### 4.5 Frontend Next (`frontend/`)

**Status:** In development, not primary runtime.  
**Language:** React + Vite  
**Purpose:** Next-generation frontend to replace `old_web/`.

A React-based rebuild of the viewer. Not yet the active production UI. Shares the same backend API contract.

---

## 5. Features

### 5.1 File Browser

The home page renders a dashboard-style file listing pulled from the configured MinIO/S3 bucket:

- **Stats cards** showing total file count, folder count, total storage size, and currently displayed count.
- **Search** to filter files by name in real time.
- **Files table** with columns for name, size, and last modified date.
- **Folder rows** are displayed for organizational context; individual `.h5` files can be opened in the viewer.
- Files list is cached server-side for 30 seconds; a manual **Refresh** action clears the cache.
- Supports up to 50,000 file entries before truncation.
- Deep-link support: open the app with `?file=<encoded-key>` to jump directly into the viewer for a specific file.

### 5.2 HDF5 Tree Navigation

The viewer sidebar shows the hierarchical internal structure of the selected HDF5 file:

- **Lazy expansion** — child entries are fetched from the backend only when a node is expanded.
- **Groups** (represented as folder nodes) can be expanded to reveal nested groups and datasets.
- **Datasets** (leaf nodes) can be selected to load their data in the main panel.
- Nodes remember expanded/collapsed state between navigations.
- Failed node loads show inline **Retry** options.
- The tree intelligently caches loaded subtrees to avoid redundant requests during the same session.
- In **line compare mode**, compatible dataset nodes show an **Add to Compare** button (compatibility constraints: same ndim, same shape, numeric dtype).

### 5.3 Inspect Mode

When Inspect mode is selected (via the Display / Inspect toggle), selecting a dataset shows its full metadata:

- Shape (dimensions and sizes)
- Data type (dtype)
- Number of dimensions
- Chunk layout and size
- Compression filters applied (e.g. gzip level, LZF)
- Fill value
- All HDF5 attributes attached to the dataset as key-value pairs
- A raw JSON dump of the complete metadata payload

Inspect mode is useful for understanding the structure and storage properties of a dataset before loading its data.

### 5.4 Matrix / Table View

The Matrix tab renders dataset values as a scrollable, virtualized 2D table:

**Preview phase:**
- A bounded slice of the dataset is rendered immediately as a static preview table when a dataset is selected.
- Default limits of 100 rows × 100 columns for 2D; larger datasets show a sampled window.

**Full interactive runtime (enabled via "Full View" toggle):**
- Virtualized DOM-pooled table rendering allowing efficient scrolling over very large datasets.
- Block-based data fetching: the viewport triggers fetch requests for the required row/column block window.
- Parallel block prefetch queue with overscan for smooth scroll behavior.
- LRU block cache keyed by file key + HDF5 path + block window coordinates.
- Server-side limits: 2000 rows × 2000 columns per request window; 500,000 elements max per JSON response.
- Configurable number notation (auto / scientific / fixed).
- Optional grid lines toggle.

**Export:**
- **CSV (Displayed):** Exports the currently loaded and visible viewport blocks as a CSV file.
- **CSV (Full):** Streams the complete dataset as CSV via the backend export endpoint (up to 10 million cells).

### 5.5 Line Graph View

The Line tab renders 1D data or a selected dimension profile of multi-dimensional data as an interactive line chart:

**Preview phase:**
- A downsampled line preview is rendered immediately using SVG.
- Preview uses up to 5,000 points with automatic downsampling for larger datasets.

**Full interactive runtime:**
- SVG-based renderer with interactive axis pan and zoom.
- Mouse wheel zoom, click-to-zoom, and drag pan.
- Keyboard navigation for fine-grained window movement.
- Window/zoom controls to specify exact element ranges.
- Quality mode selector: `auto` (adaptive), `overview` (aggressively downsampled), `exact` (full resolution up to 20,000 displayed points).
- Fullscreen panel mode.
- Dynamic point limit up to 5,000 per fetch request (backend enforced).

**Export:**
- **CSV (Displayed):** Exports currently plotted point range as CSV.
- **CSV (Full):** Streams full dataset line export via backend (up to 5 million points).
- **PNG (Current View):** Rasterizes the current SVG viewport to PNG and downloads it.

### 5.6 Heatmap View

The Heatmap tab renders 2D datasets or 2D slices of higher-dimensional data as a color-mapped canvas image:

**Preview phase:**
- A downsampled heatmap preview renders immediately at up to 512×512 resolution.
- Stats (min, max, mean, std) are displayed alongside the heatmap.

**Full interactive high-res runtime:**
- Canvas-based renderer for performance.
- Progressive loading: quick fetch at 256×256 first, then full up to 1024×1024.
- Mouse wheel zoom + drag pan on the canvas.
- Color lookup table (LUT) rendering with selectable colormaps.
- Aspect ratio lock toggle.
- **Cell selection:** clicking a heatmap pixel spawns an inline linked line chart showing the row or column profile through the selected point.
- Row profile / Column profile toggle.
- Fullscreen panel mode.
- Selection memory: view position and zoom level are restored when switching tabs and returning.

**Export:**
- **CSV (Displayed):** Exports the currently loaded heatmap grid as CSV.
- **CSV (Full):** Streams the full 2D dataset via backend export (up to 10 million cells).
- **PNG (Current View):** Captures the canvas to PNG.

### 5.7 Line Compare

A multi-series line comparison feature available in the Line tab:

- A base dataset is selected normally via the tree.
- Additional datasets can be added as **compare series** using the sidebar tree's "Add to Compare" buttons.
- Compatibility checks are enforced: compare candidates must be numeric, same ndim, same shape as the base.
- Up to 4 compare series supported (configurable).
- Compare series are fetched in parallel with the base, with individual failure reporting per series.
- All series are rendered on the same axis with distinct styling (colors, labels).
- Compare series entries are shown in the legend.
- CSV export includes a column per series.

### 5.8 Export

**CSV Export:**

All three visualization modes support two levels of CSV export:

| Mode | CSV (Displayed) | CSV (Full) |
|------|----------------|------------|
| Matrix | Current viewport blocks | Full dataset — server-streamed chunked CSV (256-row chunks) |
| Line | Current plotted window | Full 1D data — server-streamed (50,000-point chunks) |
| Heatmap | Current loaded 2D grid | Full 2D data — server-streamed |

Server-side CSV export safety: formula-like cell values (starting with `=`, `+`, `-`, `@`) are prefixed with `'` to prevent spreadsheet formula injection.

**PNG Export:**

- Line Graph: SVG serialized and rasterized to PNG via a canvas intermediate.
- Heatmap: Canvas blob captured directly as PNG.

**Filename generation** includes the dataset path and current timestamp for traceability.

### 5.9 Dimension Controls

For datasets with 3 or more dimensions, Dimension Controls allow the user to configure which axes to display:

- **Display Dims** selector: choose which two axes are rendered as row/column dimensions.
- **Fixed Indices** sliders: for all non-display dimensions, fix a specific index slice.
- Changes are **staged** (shown in the UI but not applied) until the user clicks **Apply**, enabling preview of dimension changes without triggering unnecessary API calls.
- A **Reset** button restores the last-applied configuration.
- Applies across all three visualization modes (matrix, line, heatmap).
- Debounced preview reload: preview reloads automatically after a short debounce pause when controls are adjusted.

### 5.10 Caching

The system implements a multi-layer caching strategy to minimize redundant reads from object storage:

**Backend caches (server-side, thread-safe TTL + LRU eviction):**

| Cache | TTL | Max Entries | Purpose |
|-------|-----|-------------|---------|
| Files list cache | 30 s | 200 | MinIO object listing results |
| HDF5 / tree cache | 300 s | 3,000 | children + meta + preview payloads |
| Dataset info cache | 300 s | 3,000 | Shape, dtype, ndim per dataset path |
| Data cache | 120 s | 1,200 | Windowed data payloads |

Cache keys incorporate `etag` (S3 entity tag of the object) so that cache entries are automatically invalidated when the underlying HDF5 file in storage is replaced.

**Frontend caches (client-side, in-memory LRU):**

- Files list cache
- Tree cache per file key
- Preview map cache (with optional stale-while-refresh)
- Matrix block LRU cache
- Line data LRU cache
- Heatmap data LRU cache
- Metadata LRU cache

In-flight request deduplication prevents duplicate concurrent API calls for the same resource.

---

## 6. Data Flow

### Opening a Dataset

```
1. User opens a file from the home page.
2. App switches to viewer route. Sidebar fetches root children (/children?path=/).
3. User expands tree nodes. Each expansion fetches children for that path.
4. User selects a dataset node.
5. App calls /preview?path=<hdf_path>&mode=auto.
6. Backend:
   a. Checks preview cache (keyed by file etag + path + mode + dims).
   b. On miss: opens HDF5 file (byte-range via s3fs), reads bounded slice.
   c. Shapes payload (table rows + plot points + heatmap grid + stats).
   d. Caches and returns JSON.
7. Frontend renders preview in active tab (matrix/line/heatmap).
```

### Entering Full Interactive Mode

```
1. User clicks "Full View" on a tab.
2. Runtime module initializes for the active mode.
3. Runtime fetches /data?mode=<mode>&path=<path>&[window params].
4. Backend:
   a. Checks data cache.
   b. On miss: reads bounded data window.
   c. Returns JSON.
5. Runtime renders interactive view and binds events.
6. User interactions (scroll, zoom, pan) trigger additional /data requests for new windows.
   These are cached for fast revisiting.
```

### CSV Full Export

```
1. User selects CSV (Full) from export menu.
2. Frontend calls /export/csv?mode=<mode>&path=<path>.
3. Backend streams response in chunks:
   - Matrix: 256-row chunks
   - Line: 50,000-point chunks
4. Browser triggers file download as data arrives.
```

---

## 7. API Reference

All endpoints are prefixed to the backend base URL (default: `http://localhost:5000`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check. Returns `{status, timestamp}`. |
| `GET` | `/` | Interactive endpoint dashboard (HTML). |
| `GET` | `/files/` | List all HDF5 files and folders from the configured bucket. |
| `POST` | `/files/refresh` | Clear the server-side files list cache. |
| `GET` | `/files/<key>/children` | List HDF5 group/dataset children at a given internal path. |
| `GET` | `/files/<key>/meta` | Detailed metadata for a dataset or group path. |
| `GET` | `/files/<key>/preview` | Fast preview payload (table + chart + heatmap + stats). |
| `GET` | `/files/<key>/data` | Bounded windowed data for a specific mode (matrix/line/heatmap). |
| `GET` | `/files/<key>/export/csv` | Streamed full CSV export for matrix/line/heatmap. |

**Key query parameters:**

- `path` — HDF5 internal path (e.g. `/sensors/temperature`).
- `mode` — Visualization mode: `matrix`, `line`, `heatmap`, or `auto`.
- `display_dims` — Comma-separated pair of dimension indices to display (e.g. `0,1`).
- `fixed_indices` — Comma-separated `dim=index` pairs for fixed slice dimensions.
- `max_size` — Maximum output dimension size for heatmap downsampling.
- `row_offset`, `row_limit`, `col_offset`, `col_limit` — Matrix window parameters.
- `line_dim`, `line_index`, `line_offset`, `line_limit` — Line extraction parameters.
- `quality` — Line quality: `auto`, `overview`, `exact`.
- `bucket` — Optional bucket override for multi-bucket deployments.
- `etag` — Optional S3 etag hint for cache versioning.

---

## 8. Storage Backends

The project supports two storage backends through separate backend implementations:

### MinIO / S3 (primary — `backend/`)

- Files stored in any S3-compatible object store (MinIO, AWS S3, Backblaze B2, etc.).
- Object listing via `boto3` (`list_objects_v2`).
- HDF5 file access via `s3fs` + `h5py` with byte-range HTTP reads.
- Etag-based cache versioning ensures stale reads are avoided after file updates.
- Configured via `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.

### Local / Network Filesystem (`backend_2/`)

- Files stored on a local disk or UNC network share.
- Suitable for on-premise lab environments, NAS mounts, or Docker volume mounts.
- No object store infrastructure required.
- Configured via `STORAGE_PATH_LINUX` or `STORAGE_PATH_WINDOWS` (or `STORAGE_ROOT` override).
- Shares identical route and API contract with `backend/` — the frontend (`old_web`) works with either backend without changes.

---

## 9. Configuration & Environment

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_ENDPOINT` | Yes (S3 backend) | — | MinIO/S3 endpoint URL |
| `S3_ACCESS_KEY` | Yes (S3 backend) | — | S3 access key |
| `S3_SECRET_KEY` | Yes (S3 backend) | — | S3 secret key |
| `S3_BUCKET` | Yes (S3 backend) | — | Bucket name |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `STORAGE_PATH_LINUX` | Yes (FS backend) | — | Linux/macOS filesystem path |
| `STORAGE_PATH_WINDOWS` | Yes (FS backend) | — | Windows UNC filesystem path |
| `STORAGE_ROOT` | No | — | Explicit override (takes precedence over above) |
| `HOST` | No | `0.0.0.0` | Bind address |
| `PORT` | No | `5000` | Listen port |
| `DEBUG` | No | `false` | Enable debug logging and Flask debug mode |
| `BACKEND_PUBLIC_URL` | No | — | Public URL shown in the endpoint dashboard |

### Frontend Configuration

The frontend reads its backend URL from `old_web/config/runtime-config.js`:

```js
window.__CONFIG__ = window.__CONFIG__ || {};
window.__CONFIG__.API_BASE_URL = "https://your-backend-url";
```

If not set, the default URL `https://hdf-viewer-backend.vercel.app` is used. This file is the only file that needs to be edited for a deployment.

---

## 10. Technology Stack Summary

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| API server | Python / Flask | 3.0.0 | REST API, request routing, caching |
| CORS | flask-cors | 4.0.0 | Cross-origin header handling |
| Config | python-dotenv | 1.0.0 | `.env` file loading |
| Object storage client | boto3 | 1.34.34 | S3 file listing, etag fetching |
| Remote filesystem | s3fs | 2024.2.0 | Filesystem-style access to S3 objects |
| HDF5 reading | h5py | 3.10.0 | HDF5 file parsing, dataset slicing |
| Numerics | numpy | 1.26.4 | Array math, downsampling, stats, sanitization |
| Frontend | HTML + CSS + JS | ES2020 modules | SPA UI, no build step |
| Charts | SVG + Canvas | Browser API | Line graphs (SVG) and heatmaps (Canvas) |
| State management | Vanilla JS | — | Singleton store + action pattern |
| HTTP client | fetch + AbortController | Browser API | Cancellable requests |
| Next UI (in dev) | React + Vite | — | Future production frontend |

---

## 11. Deployment Notes

### Running Locally

**Backend (S3/MinIO):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Set env vars in .env file
python app.py
```

**Frontend:**
The `old_web/` directory is pure static content. Serve it with any HTTP server:
```powershell
cd old_web
python -m http.server 8080
# or: npx serve .
```
Then open `http://localhost:8080` in a browser.

### Viewer Deep Link

To open directly to a specific file without going through the home page:
```
http://your-host/index.html?file=<url-encoded-object-key>
http://your-host/index.html?file=<url-encoded-object-key>&bucket=<bucket-name>
```

### Production WSGI

For production, run the backend via a WSGI server:
```bash
gunicorn wsgi:app --bind 0.0.0.0:5000 --workers 4
```

### Deploying Frontend to Another Repo

The `old_web/` directory can be copied into any project's static folder and pointed at any compliant backend via `config/runtime-config.js`. It has zero npm dependencies and no build step.

---

*This document describes the project as of March 2026. For backend-specific implementation detail, see [backend/docs/BACKEND_FULL_DOCUMENTATION.md](backend/docs/BACKEND_FULL_DOCUMENTATION.md). For frontend detail, see [old_web/docs/OLD_WEB_FULL_DOCUMENTATION.md](old_web/docs/OLD_WEB_FULL_DOCUMENTATION.md).*
