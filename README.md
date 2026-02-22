# HDF Viewer

A full-stack application for browsing, inspecting, and visualising HDF5 files stored in MinIO / S3-compatible object storage.

The stack is split into two independently runnable layers:

| Layer | Directory | Technology |
|---|---|---|
| REST API | `backend/` | Python · Flask · h5py · s3fs |
| Static SPA | `old_web/` | Plain ES Modules · no bundler |

---

## Repository Layout

```
HDF Viewer/
├── backend/                  # Flask REST API
│   ├── app.py                # App bootstrap, CORS, blueprints
│   ├── requirements.txt
│   ├── templates/
│   │   └── index.html        # Root dashboard UI  (GET /)
│   ├── src/
│   │   ├── routes/           # API route blueprints
│   │   ├── readers/          # HDF5 data & metadata extraction
│   │   ├── storage/          # MinIO / S3 wrapper
│   │   └── utils/            # Shared helpers (TTL cache)
│   ├── tests/                # Route-level unit tests
│   └── scripts/              # Stand-alone benchmark scripts
│
├── old_web/                  # Static frontend SPA
│   ├── index.html            # App shell & entry point
│   ├── config/
│   │   └── runtime-config.js # Runtime API URL injection
│   ├── css/                  # Design tokens + view/component styles
│   ├── js/
│   │   ├── app.js            # Bootstrap, state, routing
│   │   ├── config.js         # API_BASE_URL fallback
│   │   ├── state/            # Global store + reducers
│   │   ├── api/              # Fetch client + HDF5 service
│   │   ├── views/            # Home & viewer page render
│   │   └── components/       # Sidebar tree, toolbar, chart runtimes
│   ├── pages/                # HTML templates loaded by views
│   └── assets/               # Static assets (logo, icons)
│
├── frontend/                 # Next-generation frontend (in development)
├── docs/                     # Cross-cutting agent context & change logs
└── AGENTS.md                 # AI agent conventions for this repo
```

---

## Quick Start

### 1 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt

# Copy and fill in your MinIO / S3 credentials
cp .env.example .env           # edit S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET

python app.py
# → http://localhost:5000
```

The root route `GET /` renders an interactive dashboard listing all API endpoints with live health status and curl examples.

### 2 — Frontend (old_web)

No build step required.

```bash
# From repository root
python -m http.server 8080
```

Open `http://localhost:8080/old_web/index.html`.

The API base URL is resolved from `old_web/config/runtime-config.js` (set `window.__RUNTIME_CONFIG__.API_BASE_URL`) or falls back to `old_web/js/config.js`.

---

## Backend

### Architecture

```
Request
  └─▶ Flask route  (src/routes/)
        ├── validates query params
        ├── checks TTL cache  (src/utils/cache.py)
        └── on miss → storage / reader layer
              ├── src/storage/minio_client.py   list · head · range
              └── src/readers/hdf5_reader.py    h5py · s3fs · numpy
                    └── JSON-safe payload → cache → response
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Dashboard UI — endpoint cards, health status, runtime info |
| `GET` | `/health` | Service status + UTC timestamp |
| `GET` | `/files/` | List bucket objects (30 s cache) |
| `POST` | `/files/refresh` | Invalidate files cache |
| `GET` | `/files/<key>/children` | Immediate HDF5 group children for `?path=` |
| `GET` | `/files/<key>/meta` | Full metadata for one HDF5 object |
| `GET` | `/files/<key>/preview` | Lightweight preview payload (stats · table · plot) |
| `GET` | `/files/<key>/data` | Bounded data slice — `?mode=matrix\|heatmap\|line` |

#### Preview query parameters

| Parameter | Default | Purpose |
|---|---|---|
| `path` | `/` | HDF5 path inside file |
| `mode` | auto | `matrix`, `heatmap`, `line` |
| `display_dims` | | Axes to display |
| `fixed_indices` | | Fixed-axis index values |
| `detail` | `false` | Include full profile data |
| `max_size` | 512 | Maximum preview resolution |
| `include_stats` | `true` | Attach statistical summary |
| `etag` | | Cache-validation token |

### Caching Model

| Cache | Module | Default TTL | Covers |
|---|---|---:|---|
| Files | `_files_cache` | 30 s | `/files` listing |
| HDF5 | `_hdf5_cache` | 300 s | `/children`, `/meta`, `/preview` |
| Dataset info | `_dataset_cache` | 300 s | Dataset shape/dtype reuse in `/data` |
| Data | `_data_cache` | 120 s | Full `/data` response |

### Configuration

**Required environment variables**

| Variable | Description |
|---|---|
| `S3_ENDPOINT` | MinIO / S3 endpoint URL |
| `S3_ACCESS_KEY` | Access key ID |
| `S3_SECRET_KEY` | Secret access key |
| `S3_BUCKET` | Target bucket name |

**Optional environment variables**

| Variable | Default | Description |
|---|---|---|
| `S3_REGION` | `us-east-1` | Storage region |
| `HOST` | `0.0.0.0` | Flask bind host |
| `PORT` | `5000` | Flask bind port |
| `DEBUG` | `False` | Flask debug mode |
| `PUBLIC_BASE_URL` / `BACKEND_PUBLIC_URL` / `API_BASE_URL` / `BACKEND_URL` | — | Public URL shown in dashboard |

Dashboard base URL resolution order: `BACKEND_PUBLIC_URL` → `PUBLIC_BASE_URL` → `API_BASE_URL` → `BACKEND_URL` → `request.url_root`.

### Running Tests

```bash
cd backend
python -m unittest tests/test_hdf5_routes.py
```

### Source Map

| Path | Responsibility |
|---|---|
| `app.py` | Flask app factory, CORS (`origins="*"`), blueprint registration |
| `src/routes/files.py` | `/files` listing + cache refresh |
| `src/routes/hdf5.py` | `/children`, `/meta`, `/preview`, `/data` |
| `src/readers/hdf5_reader.py` | HDF5 path traversal, data slicing, stats |
| `src/storage/minio_client.py` | S3 list, head, byte-range fetch |
| `src/utils/cache.py` | Generic TTL cache singleton accessors |
| `templates/index.html` | Root dashboard page template |

Detailed folder-level docs live at `backend/src/routes/README.md`, `backend/src/readers/README.md`, `backend/src/storage/README.md`, `backend/src/utils/README.md`.

---

## old_web Frontend

### Architecture

```
index.html
  └─▶ config/runtime-config.js   (API URL injection)
  └─▶ js/app.js                  (bootstrap + render loop)
        ├── state/store.js        global state + subscriptions
        ├── state/reducers.js     actions → state mutations
        ├── api/client.js         fetch wrapper, abort, errors
        ├── api/hdf5Service.js    typed API calls + client-side cache
        ├── views/homeView.js     file list page
        └── views/viewerView.js   viewer layout + panel switching
              └── components/viewerPanel/
                    ├── render/sections.js     panel HTML assembly
                    ├── runtime/bindEvents.js  event delegation
                    ├── runtime/lineRuntime.js line chart interactions
                    └── runtime/heatmapRuntime.js heatmap interactions
```

### Feature Set

**Home view**
- File list with search filtering and cache refresh.
- Open file action navigates to viewer.

**Viewer — sidebar**
- Lazy-loading tree with expand / collapse, loading and retry states.
- Breadcrumb navigation between paths.
- Display / Inspect mode toggle.

**Viewer — display mode tabs**

| Tab | Preview | Full Runtime |
|---|---|---|
| Matrix | Paginated stats + sample table | Virtualized block streaming |
| Line | Single-pass SVG preview | Wheel zoom · pan · click-zoom · range nav · quality controls · panel fullscreen |
| Heatmap | Progressive high-res canvas | Pan/zoom · tooltip · crosshair · cell selection · linked line-profile panel · row/col axis switch · fullscreen isolation |

**N-dimensional controls**
- Display-dims and fixed-indices selectors with staged / apply flow.

**Inspect mode**
- Metadata summary card + raw JSON viewer.

### Key Modules

| Module | Path |
|---|---|
| App shell | `old_web/js/app.js` |
| Global state | `old_web/js/state/store.js` |
| Actions | `old_web/js/state/reducers.js` |
| API client | `old_web/js/api/client.js` |
| HDF5 service | `old_web/js/api/hdf5Service.js` |
| Home view | `old_web/js/views/homeView.js` |
| Viewer view | `old_web/js/views/viewerView.js` |
| Viewer panel render | `old_web/js/components/viewerPanel/render/sections.js` |
| Event binding | `old_web/js/components/viewerPanel/runtime/bindEvents.js` |
| Line runtime | `old_web/js/components/viewerPanel/runtime/lineRuntime.js` |
| Heatmap runtime | `old_web/js/components/viewerPanel/runtime/heatmapRuntime.js` |

### Recommended Reading Order

1. `old_web/js/app.js`
2. `old_web/js/state/store.js`
3. `old_web/js/state/reducers.js`
4. `old_web/js/views/viewerView.js`
5. `old_web/js/components/viewerPanel/render/sections.js`
6. `old_web/js/components/viewerPanel/runtime/bindEvents.js`
7. `old_web/js/components/viewerPanel/runtime/lineRuntime.js`

### UI Design Tokens

All colours live in `old_web/css/tokens.css`.

| Role | Hex |
|---|---|
| Background | `#F8FAFF` |
| Surface / Card | `#FFFFFF` |
| Surface Alt | `#F2F6FF` |
| Border | `#D9E2F2` |
| Text Primary | `#0F172A` |
| Text Secondary | `#475569` |
| Primary Blue | `#2563EB` |
| Primary Hover | `#1D4ED8` |
| Accent Sky | `#38BDF8` |
| Success | `#16A34A` |
| Warning | `#D97706` |
| Error | `#DC2626` |
| Info | `#0EA5E9` |

---

## End-to-End Data Flow

```
Browser (old_web)
  │
  │  GET /files/<key>/preview?path=/dataset&mode=heatmap
  │
  ▼
Flask route  hdf5.py
  │  cache hit? → return cached JSON
  │  cache miss ↓
  ▼
HDF5Reader  (src/readers/hdf5_reader.py)
  │  open file via s3fs + h5py
  │  slice numpy array to preview window
  │  compute stats (min/max/mean/std)
  ▼
MinioClient  (src/storage/minio_client.py)
  │  HEAD + byte-range GET from MinIO bucket
  ▼
JSON response  →  store in _hdf5_cache  →  return to browser
  │
  ▼
old_web hdf5Service.js  (client-side LRU cache)
  ▼
viewerPanel render  →  canvas heatmap / SVG line / table
```

---

## Development Notes

- **CORS**: currently `origins="*"` in `app.py`. Restrict before production deployment.
- **No build step**: `old_web` is pure ES modules served from the file system. No npm, no bundler.
- **Benchmark scripts**: `backend/scripts/` contains stand-alone benchmarking utilities; none are registered as Flask routes.
- **Agent context docs**: cross-cutting change logs are stored in `docs/`. Per-layer docs are in `backend/docs/` and `old_web/docs/`.
- **frontend/**: a next-generation React frontend is in active development in the `frontend/` directory and is not yet production-ready.

---

## Contributing

1. Backend changes: read `backend/README.md` and the relevant `src/*/README.md` folder guide first.
2. Frontend (old_web) changes: read `old_web/README.md`.
3. Document significant changes in `docs/` using the `AGENT_CONTEXT_<DATE>_<TOPIC>.md` naming convention.
