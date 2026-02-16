# HDF Viewer Backend

Flask backend for browsing HDF5 files stored in MinIO/S3.
This README is the entry point for new backend contributors.

## What Is Implemented
- Flask app bootstrap with health check and blueprint registration.
- File listing and cache refresh routes.
- HDF5 browsing routes:
  - children tree
  - metadata inspection
  - preview generation
  - bounded data slices for matrix/heatmap/line
- In-memory TTL caches for files, metadata, dataset info, and `/data` payloads.
- MinIO/S3 wrapper for list/head/range operations.
- HDF5 reader built on `s3fs + h5py + numpy`.

## Backend Structure

### Root files
- `app.py`: app setup, CORS, health endpoint, route registration.
- `templates/index.html`: root dashboard UI (`GET /`) for endpoint discovery and status.
- `requirements.txt`: runtime dependencies.
- `tests/test_hdf5_routes.py`: route-level unit tests for `/preview` and `/data` behavior.

### Source folders
- `src/routes/`: API layer.
  - Folder guide: `src/routes/README.md`
- `src/readers/`: HDF5 data/metadata extraction.
  - Folder guide: `src/readers/README.md`
- `src/storage/`: MinIO/S3 access wrapper.
  - Folder guide: `src/storage/README.md`
- `src/utils/`: shared helpers (currently cache).
  - Folder guide: `src/utils/README.md`

## Import And Dependency Flow
- `app.py` imports route blueprints from `src.routes.files` and `src.routes.hdf5`.
- `src/routes/files.py` imports:
  - `get_minio_client()` from `src.storage.minio_client`
  - `get_files_cache()` from `src.utils.cache`
- `src/routes/hdf5.py` imports:
  - `get_minio_client()` from `src.storage.minio_client`
  - `get_hdf5_reader()` from `src.readers.hdf5_reader`
  - cache helpers from `src.utils.cache`
- `src/readers/hdf5_reader.py` imports `h5py`, `s3fs`, `numpy` and provides the `HDF5Reader` singleton accessor.

## Runtime Request Flow
1. Request enters Flask route (`files.py` or `hdf5.py`).
2. Route validates query parameters and mode-specific constraints.
3. Route checks the correct cache instance.
4. On cache miss, route calls storage/reader layer:
   - storage for object list/head metadata
   - reader for HDF5 path traversal or data slicing
5. Reader sanitizes payload into JSON-safe values.
6. Route stores response in cache and returns JSON.

## API Summary

### `GET /`
- Backend dashboard page with:
  - live `/health` status indicator
  - runtime info (host/port/debug/uptime)
  - endpoint cards with parameters and curl examples

### `GET /health`
- Returns service status and UTC timestamp.

### `GET /files/`
- Lists objects in bucket with 30s cache.

### `POST /files/refresh`
- Clears files cache.

### `GET /files/<key>/children?path=/...`
- Returns immediate children of an HDF5 group/path.

### `GET /files/<key>/meta?path=/...`
- Returns detailed metadata for one HDF5 object.

### `GET /files/<key>/preview?path=/...`
- Returns lightweight preview payload (`stats`, `table`, `plot`, optional `profile`).
- Supports `display_dims`, `fixed_indices`, `mode`, `detail`, `max_size`, `include_stats`, `etag`.

### `GET /files/<key>/data?path=/...&mode=matrix|heatmap|line`
- Returns bounded data windows for rendering.
- Enforces strict limits to prevent oversized JSON payloads.

## Caching Model
| Cache | Location | Default TTL | Used By |
|---|---|---:|---|
| files cache | `src/utils/cache.py` (`_files_cache`) | 30s | `/files` |
| hdf5 cache | `src/utils/cache.py` (`_hdf5_cache`) | 300s | `/children`, `/meta`, `/preview` |
| dataset cache | `src/utils/cache.py` (`_dataset_cache`) | 300s | `/data` dataset info reuse |
| data cache | `src/utils/cache.py` (`_data_cache`) | 120s | `/data` full response cache |

## Configuration
Required environment variables:
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

Optional environment variables:
- `S3_REGION` (default `us-east-1`)
- `HOST` (default `0.0.0.0`)
- `PORT` (default `5000`)
- `DEBUG` (default `False`)
- `PUBLIC_BASE_URL` (example: `https://api.yourdomain.com`)
- `BACKEND_PUBLIC_URL` / `API_BASE_URL` / `BACKEND_URL` (alternate names accepted)

Dashboard base URL resolution order for `GET /`:
1. `BACKEND_PUBLIC_URL`
2. `PUBLIC_BASE_URL`
3. `API_BASE_URL`
4. `BACKEND_URL`
5. request host (`request.url_root`)

## Local Setup
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Testing
```bash
python -m unittest tests/test_hdf5_routes.py
```

## Notes For New Contributors
- CORS is currently configured as `origins="*"` in `app.py`.
- `/benchmark` exists as scripts in `backend/scripts/` but is not registered as a Flask route.
- Route and reader docs are maintained in folder-level README files inside `src/`.
