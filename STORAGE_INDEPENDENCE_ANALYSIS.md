# Storage Independence Analysis — HDF5 Data Pipeline

**Date:** 2026-02-26  
**Scope:** Backend (`backend/`), H5API (`H5API/`), Old Web (`old_web/`)

---

## Overview

This document analyzes whether the backend's HDF5 data reading pipeline (tree, metadata, preview, data, export) depends on the storage backend (MinIO/S3) or works independently once a file handle is obtained.

---

## Architecture: Current Data Flow

```
H5API (port 5100)              Backend (port 5000)               old_web (viewer)
──────────────────              ───────────────────               ────────────────
MinIO/S3 bucket                 Receives file key from           Renders tree,
  → lists .h5 files             old_web request                  metadata, preview,
  → user picks a file           → opens .h5 from S3 via s3fs    charts, tables,
  → file key sent to            → h5py reads HDF5 content        exports
    backend                     → returns JSON
```

---

## Dependency Breakdown

### What is storage-dependent (S3/MinIO specific)

| Component | File | What it does | S3 dependency |
|-----------|------|-------------|---------------|
| `MinIOClient` | `backend/src/storage/minio_client.py` | Lists files, gets etags/metadata | `boto3` S3 client — needs `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` |
| `HDF5Reader.__init__` | `backend/src/readers/hdf5_reader.py` (line 30–43) | Creates S3 filesystem | `s3fs.S3FileSystem(...)` hardcoded |
| `HDF5Reader._get_s3_path` | `backend/src/readers/hdf5_reader.py` (line 46) | Builds S3 path | `f"{self.bucket}/{key}"` |
| `self.s3.open(...)` calls | `backend/src/readers/hdf5_reader.py` (every method) | Opens file from S3 | `s3fs` file handle |
| `H5API` browse | `H5API/app.py` | Lists folders/files in bucket | `boto3` S3 `list_objects_v2` |
| Route etag lookups | `backend/src/routes/hdf5.py` | Gets object etag for cache invalidation | `minio.get_object_metadata(key)` |

### What is storage-independent (pure HDF5 logic)

Once `h5py.File(f, 'r')` receives a file-like object, **everything below is 100% storage-agnostic**:

| Function | What it does | Why it's independent |
|----------|-------------|---------------------|
| `get_children()` | Navigates HDF5 tree, lists groups/datasets | Uses `h5py.Group.keys()`, `isinstance(child, h5py.Dataset)` |
| `get_metadata()` | Reads attributes, dtype, shape, compression, filters | Uses `h5py.Dataset` properties and `obj.attrs` |
| `get_preview()` | Generates table + plot + heatmap preview | Uses `h5py` slicing (`dataset[slice]`) and numpy |
| `get_matrix()` | Extracts 2D block from dataset | Uses `h5py` integer/slice indexing |
| `get_line()` | Extracts 1D line profile | Uses `h5py` slicing |
| `get_heatmap()` | Extracts downsampled 2D heatmap | Uses `h5py` strided slicing |
| `get_dataset_info()` | Gets shape, dtype, ndim | Uses `h5py.Dataset` properties |
| `_compute_stats()` | Computes min/max/mean/std | Uses numpy on `h5py` slice |
| `_preview_1d()` / `_preview_2d()` | Builds preview payloads | Uses `h5py` + numpy |
| CSV export | Streams matrix/line as CSV | Calls `get_matrix()`/`get_line()` in chunks |

### Key code pattern (storage boundary)

```python
# FILE: backend/src/readers/hdf5_reader.py

# ┌── STORAGE-DEPENDENT (S3-specific) ──┐
with self.s3.open(s3_path, 'rb') as f:  │
# └─────────────────────────────────────┘
    # ┌── STORAGE-INDEPENDENT (pure HDF5) ──────────────────┐
    with h5py.File(f, 'r') as hdf:                          │
        obj = hdf[path]                                      │
        shape = list(obj.shape)                              │
        data = obj[tuple(indexer)]    # ← just reads bytes   │
        # ... all processing is h5py + numpy                 │
    # └─────────────────────────────────────────────────────┘
```

---

## Conclusion

**The HDF5 data processing logic (tree, metadata, preview, matrix, line, heatmap, stats, export) is fully storage-independent.** It only needs a file-like object passed to `h5py.File()`. The S3/MinIO coupling is limited to *how the file handle is obtained*.

---

## Changes Required to Support a Different Storage Backend

If you want to replace MinIO/S3 with another storage (local filesystem, Azure Blob, GCS, SFTP, etc.), here are the **exact changes** needed:

### Change 1: `backend/src/readers/hdf5_reader.py` — `HDF5Reader` class

**Current code (S3-hardcoded):**
```python
class HDF5Reader:
    def __init__(self):
        self.endpoint = os.getenv('S3_ENDPOINT')
        self.access_key = os.getenv('S3_ACCESS_KEY')
        self.secret_key = os.getenv('S3_SECRET_KEY')
        self.bucket = os.getenv('S3_BUCKET')

        self.s3 = s3fs.S3FileSystem(
            key=self.access_key,
            secret=self.secret_key,
            client_kwargs={'endpoint_url': self.endpoint}
        )

    def _get_s3_path(self, key):
        return f"{self.bucket}/{key}"
```

**What to change:** Replace `__init__` and `_get_s3_path` with a storage-agnostic file opener. For example:

```python
# Option A: Local filesystem
class HDF5Reader:
    def __init__(self):
        self.base_path = os.getenv('HDF5_STORAGE_PATH', '/data/hdf5files')

    def _open_file(self, key):
        """Return a file-like object for the given key."""
        file_path = os.path.join(self.base_path, key)
        return open(file_path, 'rb')
```

```python
# Option B: Azure Blob Storage
import adlfs

class HDF5Reader:
    def __init__(self):
        self.fs = adlfs.AzureBlobFileSystem(
            account_name=os.getenv('AZURE_ACCOUNT'),
            account_key=os.getenv('AZURE_KEY')
        )
        self.container = os.getenv('AZURE_CONTAINER')

    def _open_file(self, key):
        return self.fs.open(f"{self.container}/{key}", 'rb')
```

```python
# Option C: Google Cloud Storage
import gcsfs

class HDF5Reader:
    def __init__(self):
        self.fs = gcsfs.GCSFileSystem(project=os.getenv('GCS_PROJECT'))
        self.bucket = os.getenv('GCS_BUCKET')

    def _open_file(self, key):
        return self.fs.open(f"{self.bucket}/{key}", 'rb')
```

### Change 2: Every method that opens a file — replace `self.s3.open()`

There are **7 methods** that open files from S3. Each follows the same pattern:

| Method | Line (approx) |
|--------|---------------|
| `get_dataset_info()` | 53 |
| `get_preview()` | 115 |
| `get_matrix()` | 246 |
| `get_line()` | 323 |
| `get_heatmap()` | 410 |
| `get_children()` | 497 |
| `get_metadata()` | 1059 |

**Current pattern (in every method):**
```python
s3_path = self._get_s3_path(key)
with self.s3.open(s3_path, 'rb') as f:
    with h5py.File(f, 'r') as hdf:
        # ... pure HDF5 logic (NO CHANGES NEEDED HERE)
```

**Change to:**
```python
with self._open_file(key) as f:
    with h5py.File(f, 'r') as hdf:
        # ... pure HDF5 logic (NO CHANGES NEEDED HERE)
```

That's it — the entire `h5py.File(f, 'r') as hdf:` block and everything inside it stays **exactly the same**.

### Change 3: `backend/src/storage/minio_client.py` — File listing

**What it does:** Lists .h5 files in the bucket and gets object metadata (etag, size, last_modified).

**What to change:** Create an equivalent for your storage backend. For local filesystem:

```python
# backend/src/storage/local_client.py (example)
import os
import hashlib

class LocalStorageClient:
    def __init__(self):
        self.base_path = os.getenv('HDF5_STORAGE_PATH', '/data/hdf5files')

    def list_objects(self, prefix='', include_folders=False, max_items=None):
        entries = []
        search_path = os.path.join(self.base_path, prefix)
        for root, dirs, files in os.walk(search_path):
            for f in files:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, self.base_path).replace('\\', '/')
                stat = os.stat(full)
                entries.append({
                    'key': rel,
                    'size': stat.st_size,
                    'last_modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'etag': hashlib.md5(rel.encode()).hexdigest(),
                    'type': 'file',
                    'is_folder': False
                })
        return entries

    def get_object_metadata(self, key):
        full = os.path.join(self.base_path, key)
        stat = os.stat(full)
        return {
            'etag': hashlib.md5(key.encode()).hexdigest(),
            'size': stat.st_size,
            'last_modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
```

### Change 4: `backend/src/routes/hdf5.py` — Etag lookups for caching

The routes call `minio.get_object_metadata(key)` to get the file's etag for cache invalidation. This happens in:

- `get_children()` route (line ~412)
- `get_metadata()` route (line ~450)

**What to change:** Replace `get_minio_client()` calls with your storage client, or use a simpler cache invalidation strategy (e.g., file modification time).

### Change 5: `backend/src/routes/files.py` — File listing route

The `/files/` route calls `minio.list_objects()`. Replace with your storage client's equivalent.

### Change 6: `H5API/app.py` — File browser

The H5API service that lists .h5 files for the user to pick uses `boto3` S3 directly. Replace `get_minio()` and `list_prefix()` with your storage backend.

### Change 7: Environment variables

**Current (.env):**
```
S3_ENDPOINT=http://152.53.240.143:9200
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=hdf5files
```

**For local filesystem:**
```
STORAGE_TYPE=local
HDF5_STORAGE_PATH=/data/hdf5files
```

**For Azure:**
```
STORAGE_TYPE=azure
AZURE_ACCOUNT=myaccount
AZURE_KEY=mykey
AZURE_CONTAINER=hdf5files
```

---

## Summary of Changes

| # | File | What to change | Difficulty |
|---|------|---------------|------------|
| 1 | `backend/src/readers/hdf5_reader.py` | Replace `__init__` + `_get_s3_path` with `_open_file()` | Easy |
| 2 | `backend/src/readers/hdf5_reader.py` | Replace 7× `self.s3.open()` → `self._open_file()` | Easy (mechanical) |
| 3 | `backend/src/storage/minio_client.py` | Create equivalent for new storage | Medium |
| 4 | `backend/src/routes/hdf5.py` | Update etag/cache-invalidation calls | Easy |
| 5 | `backend/src/routes/files.py` | Update file listing | Easy |
| 6 | `H5API/app.py` | Update file browsing | Medium |
| 7 | `.env` files | Update environment variables | Trivial |

**Zero changes needed in:**
- All HDF5 reading/processing logic inside `h5py.File()` blocks
- Preview generation (table, line, heatmap)
- Statistics computation
- CSV export streaming
- Dimension controls / axis normalization
- All `old_web` frontend code
- All frontend code
