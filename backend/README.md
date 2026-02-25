# HDF Viewer Backend

Flask backend for browsing HDF5 files stored in S3/MinIO and serving metadata, preview, windowed data, and CSV export APIs.

## What is currently implemented

- Flask app bootstrap with CORS, health endpoint, and endpoint dashboard page.
- File list APIs with cache refresh support.
- HDF5 route APIs for children, metadata, preview, windowed data, and streamed CSV export.
- Reader layer backed by `s3fs + h5py + numpy`.
- Storage layer backed by boto3-compatible S3 APIs.
- Thread-safe in-memory TTL caches with entry limits.
- Route tests covering preview/data validations and CSV export flows.

## Quick start

1. Create and activate a virtual environment.

```bash
python -m venv venv
venv\Scripts\activate
```

2. Install dependencies.

```bash
pip install -r requirements.txt
```

3. Set required environment variables.
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

4. (Optional) set runtime variables.
- `S3_REGION` (default `us-east-1`)
- `HOST` (default `0.0.0.0`)
- `PORT` (default `5000`)
- `DEBUG` (`true` or `false`, default `false`)
- `BACKEND_PUBLIC_URL` or `PUBLIC_BASE_URL` or `API_BASE_URL` or `BACKEND_URL`

5. Run the server.

```bash
python app.py
```

For production WSGI runtimes, use `backend/wsgi.py` (example):

```bash
gunicorn wsgi:app --bind 0.0.0.0:5000
```

## Main endpoints

- `GET /`
- Renders backend dashboard (`templates/index.html`) with endpoint catalog and health status.

- `GET /health`
- Returns service health payload with timestamp.

- `GET /files/`
- Lists objects in configured bucket.
- Returns both `file` and `folder` entries by default.
- Optional query params:
  - `prefix` (string): key prefix to list.
  - `include_folders` (bool, default `true`): include derived folder entries.
  - `max_items` (int, default `20000`, max `50000`): max file entries per response.

- `POST /files/refresh`
- Clears file-list cache.

- `GET /files/<key>/children`
- Lists immediate HDF5 children at `path` (default `/`).
- Accepts keys with nested folder paths (for example `Folder_1/random_05.h5`).

- `GET /files/<key>/meta`
- Returns metadata for one HDF5 object (`path` required).
- Accepts keys with nested folder paths.

- `GET /files/<key>/preview`
- Returns preview payload for lightweight render paths.
- Supports `mode=auto|line|table|heatmap`, `detail=fast|full`, `include_stats`, `display_dims`, `fixed_indices`, `max_size`, `etag`.
- Accepts keys with nested folder paths.

- `GET /files/<key>/data`
- Returns bounded data payload for `mode=matrix|heatmap|line`.
- Enforces hard limits before data reads.
- Accepts keys with nested folder paths.

- `GET /files/<key>/export/csv`
- Streams CSV for `mode=matrix|heatmap|line`.
- Supports matrix/heatmap window params (`row_offset`, `row_limit`, `col_offset`, `col_limit`) and line params (`line_dim`, `line_index`, `line_offset`, `line_limit`, `chunk_points`, `compare_paths`).
- Accepts keys with nested folder paths.

## Runtime limits in routes (`src/routes/hdf5.py`)

- `MAX_ELEMENTS = 1_000_000`
- `MAX_JSON_ELEMENTS = 500_000`
- `MAX_MATRIX_ROWS = 2000`
- `MAX_MATRIX_COLS = 2000`
- `MAX_LINE_POINTS = 5000`
- `MAX_LINE_EXACT_POINTS = 20000`
- `MAX_HEATMAP_SIZE = 1024`
- `MAX_EXPORT_CSV_CELLS = 10_000_000`
- `MAX_EXPORT_LINE_POINTS = 5_000_000`

## Cache model (`src/utils/cache.py`)

- Files cache: TTL 30s, max 200 entries.
- HDF5 cache: TTL 300s, max 3000 entries.
- Dataset cache: TTL 300s, max 3000 entries.
- Data cache: TTL 120s, max 1200 entries.

## Folder map

- `app.py`: Flask app bootstrap and blueprint registration.
- `templates/index.html`: backend dashboard UI.
- `src/routes/`: HTTP route layer.
- `src/readers/`: HDF5 read and payload shaping layer.
- `src/storage/`: MinIO/S3 client wrapper.
- `src/utils/`: cache utility and shared helpers.
- `tests/test_hdf5_routes.py`: route tests.

## Tests

Run unit tests for HDF5 route behavior:

```bash
python -m unittest tests/test_hdf5_routes.py
```

## Contributor notes

- `app.url_map.strict_slashes = False` is enabled to avoid slash redirect issues.
- CORS currently allows all origins (`origins="*"`).
- `/export/csv` is the backend contract used by frontend full CSV exports.
- CSV export now prefixes formula-like cells to prevent spreadsheet formula injection.
