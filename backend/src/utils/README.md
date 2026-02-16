# Utils Folder README

## Purpose
This folder contains shared utility code used across route modules.

## File In This Folder

### `cache.py`

#### What is imported
- Standard library: `time`, `logging`
- Typing: `Any`, `Optional`, `Tuple`
- Threading: `Lock`

#### Class implemented
- `SimpleCache`
  - Thread-safe in-memory TTL cache.
  - Internal storage:
    - `value`
    - `expires_at`
    - `created_at`

#### Methods implemented
- `get(key)`
  - Returns cached value if key exists and TTL is valid.
- `set(key, value, ttl=None)`
  - Stores value with default or custom TTL.
- `delete(key)`
  - Removes one key.
- `clear()`
  - Removes all keys.
- `clear_pattern(pattern)`
  - Removes keys containing substring `pattern`.
- `stats()`
  - Returns `total_entries`, `active_entries`, `expired_entries`.

#### Global cache instances implemented
- `_files_cache = SimpleCache(default_ttl=30)`
- `_hdf5_cache = SimpleCache(default_ttl=300)`
- `_dataset_cache = SimpleCache(default_ttl=300)`
- `_data_cache = SimpleCache(default_ttl=120)`

#### Public accessor functions
- `get_files_cache()`
- `get_hdf5_cache()`
- `get_dataset_cache()`
- `get_data_cache()`
- `make_cache_key(*parts)` (joins with `:`)

## Who imports this module
- `backend/src/routes/files.py`:
  - `get_files_cache`
- `backend/src/routes/hdf5.py`:
  - `get_hdf5_cache`
  - `get_dataset_cache`
  - `get_data_cache`
  - `make_cache_key`
