# Backend Docs (HDF Viewer)

## Purpose
Flask API for browsing HDF5 files stored in MinIO/S3 with lazy tree navigation and metadata caching.

## Stack and dependencies
- Python + Flask + flask-cors
- boto3 (MinIO/S3)
- s3fs + h5py (HDF5)
- numpy pinned to 1.26.4 to stay ABI-compatible with h5py 3.10.0

See `backend/requirements.txt` for exact versions.

## Configuration (.env)
Required:
- S3_ENDPOINT
- S3_ACCESS_KEY
- S3_SECRET_KEY
- S3_BUCKET

Optional:
- S3_REGION (default: us-east-1)
- HOST (default: 0.0.0.0)
- PORT (default: 5000)
- DEBUG (default: False)

Example:
```
HOST=0.0.0.0
PORT=5000
DEBUG=True

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=hdf5files
```

## Endpoints
All routes are registered in `backend/app.py`.

- GET `/health`
  - Simple health response with timestamp.

- GET `/files`
  - Returns `{ key, size, last_modified, etag }[]`.
  - Uses in-memory cache (30s TTL). Response includes `cached` flag.

- POST `/files/refresh`
  - Clears the files cache.

- GET `/files/<key>/children?path=/`
  - Lists immediate children at a given HDF5 path.
  - Cached by `(key, etag, path)` with 5 min TTL.
  - Groups: `name, path, type=group, num_children`.
  - Datasets: `name, path, type=dataset, shape, dtype, size, ndim` plus optional `chunks`, `compression`.
  - Optional attributes (datasets only): `attributes` (dict of up to 10), `num_attributes`, `attributes_truncated`.

- GET `/files/<key>/meta?path=/some/path`
  - Returns detailed metadata for a single object.
  - Cached by `(key, etag, path)` with 5 min TTL.
  - Common: `name, path, kind` and `attributes` as a list of `{name, value}` (up to 20).
  - Dataset extras: `shape, dtype, size, ndim, chunks, compression, compression_opts`.
  - Type details:
    - `type`: human-readable type info (class, signed, endianness, size).
    - `rawType`: low-level dtype info.
    - `filters`: compression and filter pipeline list.

- GET `/files/<key>/preview?path=/some/path`
  - Returns a lightweight preview payload for datasets (fast render).
  - Cached by `(key, etag, path, preview_type, display_dims, fixed_indices, max_size, mode)`.
  - Common fields: `path, dtype, shape, ndim, preview_type`.
  - `stats`: sample-based `min/max/mean/std` with `sample_size`.
  - `table`: small 1D/2D sample for immediate display.
  - `plot`: line (1D) or heatmap (2D/ND) payload with downsampling.
  - `profile`: row profile for 2D/ND planes (downsampled).
  - Optional params:
    - `display_dims=1,2` (2D plane for ND, defaults to last two dims)
    - `fixed_indices=0=5,1=10` (indices for non-display dims, defaults to middle)
    - `max_size=512` (max heatmap dimension, clamped to 512)
    - `mode=auto` (reserved for preview strategy)

## Caching
- Files cache: 30 seconds (`_files_cache`).
- HDF5 cache: 300 seconds (`_hdf5_cache`).
- Both are in-memory and unbounded until TTL expiry.
- Cache keys include S3 etag so updates invalidate automatically.

## Storage and HDF5 access
- MinIO client: `backend/src/storage/minio_client.py`.
- HDF5 reader: `backend/src/readers/hdf5_reader.py` uses s3fs + h5py for lazy reads.
- `get_object_range()` exists for explicit HTTP range reads (not used by the reader directly).

## Scripts
Located in `backend/scripts/`:
- `benchmark.py` (standalone performance tests)
- `test_minio.py` (connectivity check)
- `verify_range_requests.py` (range header verification)

## Known behavior and gaps
- `/benchmark` is not registered in `backend/app.py`.
- Missing object keys or invalid paths in `/meta` raise a 500 (ValueError/ClientError).
- `/children` returns an empty list when a path does not exist.
- CORS currently allows all origins and ignores `CORS_ORIGINS`.

## Not implemented yet
- `/data` endpoint for actual dataset values.
- Authentication/authorization.
- Persistent cache (Redis).
