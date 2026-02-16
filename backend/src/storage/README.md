# Storage Folder README

## Purpose
This folder contains the S3/MinIO integration used by route handlers and HDF5 workflows.

## File In This Folder

### `minio_client.py`

#### What is imported
- Standard library: `os`, `logging`
- Typing: `List`, `Dict`, `Optional`, `BinaryIO`
- AWS SDK:
  - `boto3`
  - `Config` from `botocore.client`
  - `ClientError` from `botocore.exceptions`

#### Class implemented
- `MinIOClient`
  - Reads env vars:
    - `S3_ENDPOINT`
    - `S3_REGION` (default `us-east-1`)
    - `S3_ACCESS_KEY`
    - `S3_SECRET_KEY`
    - `S3_BUCKET`
  - Validates required values and creates an S3-compatible boto3 client.

#### Methods implemented
- `list_objects(prefix='')`
  - Uses `list_objects_v2` paginator.
  - Returns object entries with `key`, `size`, `last_modified`, `etag`.
- `get_object_metadata(key)`
  - Uses `head_object`.
  - Returns `key`, `size`, `last_modified`, `etag`, `content_type`.
- `open_object_stream(key)`
  - Uses `get_object`.
  - Returns full object stream (`Body`).
- `get_object_range(key, start, end)`
  - Uses HTTP `Range` header with `get_object`.
  - Returns byte slice for random access scenarios.

#### Singleton implemented
- Global instance: `_minio_client`
- Factory/accessor: `get_minio_client()`

## Who imports this module
- `backend/src/routes/files.py`
  - Uses `list_objects()` for `/files`.
- `backend/src/routes/hdf5.py`
  - Uses `get_object_metadata()` for etag-based cache invalidation.
