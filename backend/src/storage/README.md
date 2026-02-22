# backend/src/storage

Storage integration layer for S3/MinIO operations.

## File

- `minio_client.py`

## Class

- `MinIOClient`

Reads environment config:
- `S3_ENDPOINT`
- `S3_REGION` (default `us-east-1`)
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

## Implemented operations

- `list_objects(prefix='')`
- Lists objects using paginator (`list_objects_v2`).
- Returns `key`, `size`, `last_modified`, `etag`.

- `get_object_metadata(key)`
- Uses `head_object`.
- Returns object metadata including `etag` used for cache-version semantics.

- `open_object_stream(key)`
- Opens full object stream with `get_object`.

- `get_object_range(key, start, end)`
- Performs byte-range GET using HTTP `Range` header.

## Singleton accessor

- `get_minio_client()` returns global `MinIOClient` instance.

## Imported by

- `backend/src/routes/files.py`
- `backend/src/routes/hdf5.py`
