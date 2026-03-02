# backend/src/storage

Filesystem storage integration layer.

## Files

- `filesystem_client.py`
- `__init__.py`

## Main class

- `FilesystemStorageClient`

Reads environment config:
- `STORAGE_ROOT` (optional explicit root)
- `STORAGE_PATH_LINUX`
- `STORAGE_PATH_WINDOWS`

## Implemented operations

- `list_objects(prefix='', include_folders=False, max_items=None, bucket=None)`
- Recursively lists files under the active storage root.
- Can include derived folder rows from file keys.
- Returns `key`, `size`, `last_modified`, `etag`, `type`, `is_folder`.

- `get_object_metadata(key, bucket=None)`
- Reads local file metadata (`size`, `last_modified`, synthetic `etag`, `content_type`).

- `open_object_stream(key, bucket=None)`
- Opens file stream for reading.

- `get_object_range(key, start, end, bucket=None)`
- Reads byte range from a file.

- `resolve_object_path(key, bucket=None)`
- Resolves a key to an absolute path and validates it stays inside storage root.

## Singleton accessor

- `get_storage_client()` returns global `FilesystemStorageClient` instance.

## Imported by

- `backend/src/routes/files.py`
- `backend/src/routes/hdf5.py`
- `backend/src/readers/hdf5_reader.py`
