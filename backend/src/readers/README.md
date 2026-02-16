# Readers Folder README

## Purpose
This folder contains the data access layer that opens HDF5 files from MinIO/S3 and converts them into API-safe payloads.

## File In This Folder

### `hdf5_reader.py`

#### What is imported
- Standard library: `os`, `math`, `logging`
- Typing: `List`, `Dict`, `Any`, `Optional`, `Tuple`
- Data stack:
  - `h5py`
  - `s3fs`
  - `numpy as np`

#### Main class implemented
- `HDF5Reader`
  - Initializes an `s3fs.S3FileSystem` client using:
    - `S3_ENDPOINT`
    - `S3_ACCESS_KEY`
    - `S3_SECRET_KEY`
    - `S3_BUCKET`

#### Methods implemented

##### Dataset info and axis normalization
- `_get_s3_path(key)`
- `get_dataset_info(key, path)`
- `normalize_preview_axes(shape, display_dims_param, fixed_indices_param)`
- `_parse_display_dims(param, ndim)`
- `_parse_fixed_indices(param, ndim)`
- `_default_index(shape, dim)`
- `_clamp_index(shape, dim, index)`

##### Preview generation (`/preview`)
- `get_preview(...)`
- `_compute_stats(dataset, shape, numeric)`
- `_preview_1d(...)`
- `_preview_2d(...)`
- `_compute_strides(shape, target)`
- `_total_elements(shape)`
- `_is_numeric_dtype(dtype)`

##### Data extraction (`/data`)
- `get_matrix(...)`
- `get_line(...)`
- `get_heatmap(...)`
- `_build_indexer(ndim, display_dims, fixed_indices, dim_slices)`

##### Metadata and tree browsing
- `get_children(key, path='/')`
- `get_metadata(key, path)`
- `_get_type_info(dtype)`
- `_get_raw_type_info(dtype)`
- `_get_filters_info(dataset)`

##### JSON sanitization
- `_safe_number(value)`
- `_sanitize_numpy_array(array)`
- `_sanitize(data)`

##### Singleton accessor
- Global instance: `_hdf5_reader`
- Factory/accessor: `get_hdf5_reader()`

## What this reader returns to routes
- For `children`:
  - Group/dataset node lists with shape/dtype/chunks/compression/attribute previews
- For `meta`:
  - Type info, raw dtype info, filters, attributes, size, shape, chunk/compression metadata
- For `preview`:
  - `stats`, `table`, `plot`, `profile`, and limit metadata for fast UI rendering
- For `data`:
  - Strictly bounded `matrix`, `heatmap`, and `line` payloads with downsample info

## Who imports this module
- `backend/src/routes/hdf5.py` imports `get_hdf5_reader()`.
