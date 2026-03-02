# backend/src/utils

Shared utilities used by backend routes.

## File

- `cache.py`

## `SimpleCache`

Thread-safe in-memory TTL cache backed by `OrderedDict` + `Lock`.

Implemented methods:
- `get(key)`
- `set(key, value, ttl=None)`
- `delete(key)`
- `clear()`
- `clear_pattern(pattern)`
- `stats()`

Behavior notes:
- Expired entries are dropped on read.
- Entry order is updated on hit/set.
- Oldest entries are evicted when `max_entries` is exceeded.

## Global cache instances

- `_files_cache = SimpleCache(default_ttl=30, max_entries=200)`
- `_hdf5_cache = SimpleCache(default_ttl=300, max_entries=3000)`
- `_dataset_cache = SimpleCache(default_ttl=300, max_entries=3000)`
- `_data_cache = SimpleCache(default_ttl=120, max_entries=1200)`

Public accessors:
- `get_files_cache()`
- `get_hdf5_cache()`
- `get_dataset_cache()`
- `get_data_cache()`

Helper:
- `make_cache_key(*parts)` joins key segments with `:`.

## Imported by

- `backend/src/routes/files.py`
- `backend/src/routes/hdf5.py`
