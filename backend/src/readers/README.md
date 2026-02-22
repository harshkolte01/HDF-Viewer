# backend/src/readers

Reader layer for HDF5 traversal and data extraction.

## File

- `hdf5_reader.py`

## Purpose

- Open HDF5 objects from S3/MinIO through `s3fs`.
- Extract children, metadata, preview, and data slices.
- Return JSON-safe payloads for Flask routes.

## Main class

- `HDF5Reader`

Initialization reads:
- `S3_ENDPOINT`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

## Core read APIs

- `get_dataset_info(key, path)`
- Returns lightweight metadata: `shape`, `ndim`, `dtype`.

- `get_children(key, path='/')`
- Returns immediate child nodes for groups/datasets.

- `get_metadata(key, path)`
- Returns metadata details including dtype info, attributes, chunk/compression/filter info.

- `get_preview(...)`
- Produces lightweight preview payload for 1D/2D/ND datasets.
- Supports `mode` and `detail` filtering (`fast` and `full`).
- Supports axis normalization with `display_dims` and `fixed_indices`.

- `get_matrix(...)`
- Extracts bounded 2D matrix window.

- `get_line(...)`
- Extracts bounded line profile with optional downsampling step.

- `get_heatmap(...)`
- Extracts downsampled 2D heatmap plane with optional stats.

## Reader limits/constants

Key constants in `hdf5_reader.py`:
- `MAX_PREVIEW_ELEMENTS`
- `MAX_HEATMAP_SIZE`
- `MAX_HEATMAP_ELEMENTS`
- `MAX_LINE_POINTS`
- `TABLE_1D_MAX`
- `TABLE_2D_MAX`
- `MAX_STATS_SAMPLE`

## Sanitization guarantees

- Converts numpy arrays/scalars into JSON-safe Python values.
- Converts non-finite floats to `None`.
- Converts complex values to strings.
- Converts bytes to UTF-8 (best effort).

## Singleton accessor

- `get_hdf5_reader()` returns a global singleton reader instance.

## Imported by

- `backend/src/routes/hdf5.py`
