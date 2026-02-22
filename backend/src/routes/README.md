# backend/src/routes

HTTP route layer for the backend.

## Files

- `files.py`
- `hdf5.py`

## `files.py`

Implemented endpoints:
- `GET /files/`
- Returns object list from MinIO/S3 and caches result under `files_list`.

- `POST /files/refresh`
- Clears files cache.

Imports:
- `get_minio_client` from `src.storage.minio_client`
- `get_files_cache` from `src.utils.cache`

## `hdf5.py`

Blueprint:
- `hdf5_bp`

Implemented endpoints:
- `GET /files/<key>/children`
- `GET /files/<key>/meta`
- `GET /files/<key>/preview`
- `GET /files/<key>/data`
- `GET /files/<key>/export/csv`

Core responsibilities:
- Parse and validate query params.
- Normalize `display_dims` and `fixed_indices`.
- Apply request-level hard limits before heavy reads.
- Build deterministic cache keys for preview/data routes.
- Return consistent JSON errors for validation and not-found cases.

## `/preview` contract

Required:
- `path`

Supported params:
- `mode=auto|line|table|heatmap`
- `detail=fast|full`
- `include_stats`
- `display_dims`
- `fixed_indices`
- `max_size`
- `etag`

Behavior:
- Uses preview cache (`get_hdf5_cache`) keyed by file + normalized request shape.
- Passes normalized options to `HDF5Reader.get_preview()`.

## `/data` contract

Required:
- `path`
- `mode=matrix|heatmap|line`

Shared params:
- `display_dims`
- `fixed_indices`
- `etag`

Mode-specific params:
- matrix: `row_offset`, `row_limit`, `col_offset`, `col_limit`, `row_step`, `col_step`
- heatmap: `max_size`, `include_stats`
- line: `line_dim`, `line_index`, `line_offset`, `line_limit`, `quality`, `max_points`

Behavior:
- Uses dataset cache for shape/dtype metadata.
- Uses data cache for finalized response payloads.
- Enforces line exact window rules and heatmap size clamp rules.

## `/export/csv` contract

Required:
- `path`
- `mode=matrix|heatmap|line`

Matrix and heatmap export behavior:
- Streams CSV with BOM.
- Uses matrix reader calls in chunks.
- Supports window params and chunk params (`chunk_rows`, `chunk_cols`).
- Enforces `MAX_EXPORT_CSV_CELLS`.

Line export behavior:
- Streams CSV with columns `index,base,...compare`.
- Supports `line_dim`, `line_index`, `line_offset`, `line_limit`, `chunk_points`.
- Supports `compare_paths` (up to 4).
- Validates compare dtype numeric and compare shape equal to base shape.
- Enforces `MAX_EXPORT_LINE_POINTS`.

## Route-level limits and defaults

Key constants in `hdf5.py`:
- `MAX_JSON_ELEMENTS`, `MAX_ELEMENTS`
- `MAX_MATRIX_ROWS`, `MAX_MATRIX_COLS`
- `MAX_LINE_POINTS`, `MAX_LINE_EXACT_POINTS`
- `MAX_HEATMAP_SIZE`, `DEFAULT_MAX_SIZE`
- `MAX_EXPORT_CSV_CELLS`, `MAX_EXPORT_LINE_POINTS`
- export chunk defaults for matrix and line

## Cache usage in routes

- files cache: list file objects
- hdf5 cache: children, metadata, preview payloads
- dataset cache: dataset shape/ndim/dtype metadata
- data cache: finalized `/data` response payloads

## Registered by

`backend/app.py`:
- `app.register_blueprint(files_bp, url_prefix='/files')`
- `app.register_blueprint(hdf5_bp, url_prefix='/files')`
