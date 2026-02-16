# Routes Folder README

## Purpose
This folder contains the HTTP API layer for the backend.  
Each route validates request input, calls storage/reader services, applies caching, and returns JSON responses.

## Files In This Folder

### `files.py`

#### What is implemented
- Blueprint: `files_bp`
- Endpoint: `GET /files/`
  - Lists bucket objects via `MinIOClient.list_objects()`
  - Uses files cache (`get_files_cache()`) with key `files_list`
  - Returns `{ success, count, files, cached }`
- Endpoint: `POST /files/refresh`
  - Clears files cache (`cache.clear()`)
  - Returns `{ success, message }`

#### What is imported
- `logging`
- `Blueprint`, `jsonify` from `flask`
- `get_minio_client` from `src.storage.minio_client`
- `get_files_cache` from `src.utils.cache`

---

### `hdf5.py`

#### What is implemented
- Blueprint: `hdf5_bp`
- Parsing/validation helpers for:
  - integer params (`_parse_int_param`)
  - display dimensions (`_parse_display_dims`)
  - fixed indices (`_parse_fixed_indices`, `_fill_fixed_indices`)
  - line settings (`_parse_line_dim`, `_parse_line_quality`)
  - preview options (`_parse_preview_detail`, `_parse_bool_param`)
- Cache helpers:
  - `_resolve_cache_version_tag`
  - `_serialize_request_args`
  - `_get_cached_dataset_info`
- Guard helpers:
  - `_normalize_selection`
  - `_compute_safe_heatmap_size`
  - `_enforce_element_limits`
  - `_is_not_found_error`

#### Endpoints implemented
- `GET /files/<key>/children`
  - Reads `path` (default `/`)
  - Uses object metadata (`etag`) for cache key invalidation
  - Calls `HDF5Reader.get_children()`
- `GET /files/<key>/meta`
  - Requires `path`
  - Uses object metadata (`etag`) for cache key invalidation
  - Calls `HDF5Reader.get_metadata()`
- `GET /files/<key>/preview`
  - Requires `path`
  - Supports `mode`, `detail`, `include_stats`, `display_dims`, `fixed_indices`, `max_size`, `etag`
  - Calls `HDF5Reader.get_preview()`
- `GET /files/<key>/data`
  - Requires `path`, `mode` (`matrix|heatmap|line`)
  - Supports display/fixed indexing, pagination, sampling, quality flags, and caching
  - Calls:
    - `HDF5Reader.get_dataset_info()`
    - `HDF5Reader.get_matrix()` or `get_heatmap()` or `get_line()`

#### What is imported
- Standard library: `logging`, `math`, `time`
- Flask: `Blueprint`, `request`, `jsonify`
- `get_minio_client` from `src.storage.minio_client`
- `get_hdf5_reader` from `src.readers.hdf5_reader`
- Caches from `src.utils.cache`:
  - `get_hdf5_cache`
  - `get_dataset_cache`
  - `get_data_cache`
  - `make_cache_key`

## Cache Usage In This Folder
- `files.py`:
  - Files list cache: `get_files_cache()`
- `hdf5.py`:
  - Preview/meta/children cache: `get_hdf5_cache()`
  - Dataset shape/dtype cache: `get_dataset_cache()`
  - `/data` response cache: `get_data_cache()`

## Registered By
- `backend/app.py`:
  - `app.register_blueprint(files_bp, url_prefix='/files')`
  - `app.register_blueprint(hdf5_bp, url_prefix='/files')`
