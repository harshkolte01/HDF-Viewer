# Backend Implementation (HDF Viewer)

As of 2026-02-05.

## Purpose
Flask API for browsing HDF5 files stored in MinIO/S3 with lazy navigation, metadata inspection, preview generation, and bounded data extraction for charts/tables.

## Structure
- `backend/app.py` wires logging, CORS, health endpoint, and registers blueprints.
- `backend/src/routes/files.py` implements file listing and cache refresh.
- `backend/src/routes/hdf5.py` implements HDF5 navigation, metadata, preview, and `/data`.
- `backend/src/readers/hdf5_reader.py` performs HDF5 reads via s3fs + h5py and builds preview/data payloads.
- `backend/src/storage/minio_client.py` wraps S3/MinIO operations.
- `backend/src/utils/cache.py` provides in-memory TTL caches.

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

## Dependencies
- `flask==3.0.0`
- `flask-cors==4.0.0`
- `python-dotenv==1.0.0`
- `boto3==1.34.34`
- `numpy==1.26.4`
- `h5py==3.10.0`
- `s3fs==2024.2.0`

## Implemented API

### GET `/health`
Returns service status plus UTC timestamp.

### GET `/files`
Lists objects in the configured bucket.
- Uses a 30s in-memory cache (`cached` flag in response).
- Each item includes `key`, `size`, `last_modified`, `etag`.

### POST `/files/refresh`
Clears the files list cache.

### GET `/files/<key>/children?path=/some/path`
Lists immediate children at a given HDF5 path.
- Default `path` is `/`.
- Cached by `(key, etag, path)` for 5 minutes.
- Group entries include: `name`, `path`, `type=group`, `num_children`.
- Dataset entries include: `name`, `path`, `type=dataset`, `shape`, `dtype`, `size`, `ndim`.
- Dataset extras when available: `chunks`, `compression`.
- Dataset attributes: up to 10 key/value pairs, plus `num_attributes` and `attributes_truncated` when applicable.

### GET `/files/<key>/meta?path=/some/path`
Returns detailed metadata for a single object.
- Requires `path` query parameter.
- Cached by `(key, etag, path)` for 5 minutes.
- Common fields: `name`, `path`, `kind`, `attributes` (up to 20 entries).
- Group fields: `num_children`.
- Dataset fields: `shape`, `dtype`, `size`, `ndim`, `chunks`, `compression`, `compression_opts`.
- Type detail fields: `type` (class/signed/endianness/size), `rawType` (low-level dtype info), `filters` (compression/shuffle/fletcher32).

### GET `/files/<key>/preview?path=/some/path`
Generates a fast preview payload for datasets.
- Cached by `(key, etag, path, preview_type, display_dims, fixed_indices, max_size, mode)` for 5 minutes.
- Common fields: `path`, `dtype`, `shape`, `ndim`, `preview_type`, `stats`, `table`, `plot`, `profile`, `limits`.
- 1D previews return a table (up to 1000 values) and a downsampled line plot.
- 2D/ND previews return a table (up to 200x200), a heatmap plot (downsampled, max 512 per axis, capped to ~200k cells), and a row profile line.
- Non-numeric datasets report `stats.supported=false` and `plot.supported=false`.
- `display_dims` and `fixed_indices` control the 2D plane for ND datasets.

### GET `/files/<key>/data?path=/some/path&mode=matrix|heatmap|line`
Returns bounded data slices for tables and charts. This endpoint is implemented with strict validation.

Shared behavior:
- Requires `path` and `mode`.
- Supports `display_dims` and `fixed_indices` with negative indexing.
- Enforces element caps (`max_elements` and `max_json_elements`).

Matrix mode (`mode=matrix`):
- Params: `row_offset`, `row_limit`, `col_offset`, `col_limit`, `row_step`, `col_step`.
- Defaults: `row_limit=100`, `col_limit=100`, steps default to `1`.
- Hard caps: max 2000x2000 output, plus overall element limits.
- Returns: `data`, `shape`, `dtype`, `row_offset`, `col_offset`, `downsample_info`, plus `source_shape`, `source_ndim`, `display_dims`, `fixed_indices`.

Heatmap mode (`mode=heatmap`):
- Param: `max_size` (default 512, capped at 1024).
- Returns: `data`, `shape`, `dtype`, `stats`, `downsample_info`, `sampled`, plus `source_shape`, `source_ndim`, `display_dims`, `fixed_indices`.

Line mode (`mode=line`):
- Params: `line_dim` (row, col, or numeric dim), `line_index`, `line_offset`, `line_limit`.
- Auto-downsamples to max 5000 points.
- Returns: `data`, `shape`, `dtype`, `axis`, `index`, `downsample_info`, plus `source_shape`, `source_ndim`, `display_dims`, `fixed_indices`.

## Caching
- Files cache: 30s (`_files_cache`).
- HDF5 cache: 300s (`_hdf5_cache`) for children/meta/preview payloads.
- Dataset info cache: 300s (`_dataset_cache`) to avoid repeated metadata reads.
- Cache keys include S3 `etag` for automatic invalidation on object changes.

## Storage Layer
- `MinIOClient` wraps S3-compatible calls: list objects, HEAD metadata, range reads, and full stream reads.
- HDF5 access uses `s3fs.S3FileSystem` + `h5py` with lazy reads.

## Data Sanitization
All payloads are JSON-safe:
- Bytes are decoded to UTF-8 with fallback.
- Numpy scalars and arrays are converted to native types/lists.
- Complex values are stringified.
- Non-finite floats are normalized to `null`.

## Limits and Safeguards
- Preview limits: `MAX_PREVIEW_ELEMENTS=250k`, `MAX_HEATMAP_SIZE=512`, `MAX_HEATMAP_ELEMENTS=200k`, `MAX_LINE_POINTS=5000`.
- `/data` limits: `MAX_ELEMENTS=1,000,000`, `MAX_JSON_ELEMENTS=500,000`, `MAX_MATRIX_ROWS=2000`, `MAX_MATRIX_COLS=2000`, `MAX_HEATMAP_SIZE=1024`.

## Scripts
- `backend/scripts/benchmark.py` (performance measurements).
- `backend/scripts/test_minio.py` (connectivity check).
- `backend/scripts/verify_range_requests.py` (range header verification).

## Notes and Gaps
- `/benchmark` is not registered in `backend/app.py` (script exists, route does not).
- CORS is currently hardcoded to allow all origins; `CORS_ORIGINS` is not used.
- Authn/authz and persistent cache (e.g., Redis) are not implemented.
