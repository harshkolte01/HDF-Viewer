# Storage Swap Guide — HDF Viewer

## Architecture Principle

The backend's core dependency is **h5py**, not any specific storage system. S3/MinIO is just a transport layer to deliver a file handle to h5py. Swapping storage is a small, isolated change.

---

## What NEVER Changes (Regardless of Storage)

| Layer | Reason |
|-------|--------|
| All h5py data logic — slicing, preview, matrix, line, heatmap, stats | Operates on `h5py.File` object, doesn't care where it came from |
| All old_web UI — viewer panel, charts, tables, state management | Talks to backend REST API, has no storage awareness |
| All API endpoint patterns — `/files/<key>/children`, `/meta`, `/preview`, `/data`, `/export/csv` | REST contract is storage-independent |
| old_web routing — `?file=<path>` deep link | Just a path identifier |

---

## Current Setup: S3/MinIO

### How Backend Opens Files

```python
# backend/src/readers/hdf5_reader.py
self.s3 = s3fs.S3FileSystem(key=..., secret=..., client_kwargs={'endpoint_url': ...})

s3_path = f"{bucket}/{key}"               # "hdf5files2/data.h5"
with self.s3.open(s3_path, 'rb') as f:     # s3fs file-like object (HTTP range requests)
    with h5py.File(f, 'r') as hdf:         # h5py reads from file-like object
        # ... all data logic here
```

### How Backend Lists Files

```python
# backend/src/storage/minio_client.py
self.client = boto3.client('s3', endpoint_url=..., ...)
response = self.client.list_objects_v2(Bucket=bucket)
```

### Config (backend/.env)

```
S3_ENDPOINT=http://152.53.240.143:9200
S3_BUCKET=hdf5files
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

### File Browser → Viewer Flow

```
H5API (S3 browser) → goToFile() → old_web/?file=data.h5&bucket=hdf5files2
old_web reads ?file and ?bucket → stores in state → sends ?bucket= on API calls
Backend reads ?bucket from query → uses in s3_path → s3fs.open("hdf5files2/data.h5")
```

---

## Alternative Setup: Linux Filesystem

### How Backend Would Open Files

```python
# backend/src/readers/hdf5_reader.py
from pathlib import Path

BASE_DIR = Path(os.environ.get("HDF5_BASE_DIR", "/mnt/hdf5"))

local_path = BASE_DIR / key                # "/mnt/hdf5/data.h5"
with h5py.File(str(local_path), 'r') as hdf:  # direct file path
    # ... SAME data logic, zero changes
```

### How Backend Would List Files

```python
# backend/src/storage/local_client.py
from pathlib import Path

BASE_DIR = Path(os.environ.get("HDF5_BASE_DIR", "/mnt/hdf5"))
HDF5_EXTENSIONS = {".h5", ".hdf5", ".hdf"}

def list_files(prefix=""):
    search_dir = BASE_DIR / prefix
    files = []
    for p in search_dir.rglob("*"):
        if p.suffix.lower() in HDF5_EXTENSIONS and p.is_file():
            files.append({
                "key": str(p.relative_to(BASE_DIR)),
                "size": p.stat().st_size,
                "last_modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat()
            })
    return files
```

### Config (backend/.env)

```
HDF5_BASE_DIR=/mnt/hdf5
```

### File Browser → Viewer Flow

```
File browser page → goToFile() → old_web/?file=subdir/data.h5
old_web reads ?file → stores in state → sends on API calls (no ?bucket needed)
Backend reads file key → resolves to /mnt/hdf5/subdir/data.h5 → h5py.File()
```

---

## Exact Files That Change Per Swap

| File | S3/MinIO | Linux Filesystem |
|------|----------|------------------|
| `backend/.env` | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | `HDF5_BASE_DIR=/mnt/hdf5` |
| `backend/src/readers/hdf5_reader.py` | `__init__`: creates `s3fs.S3FileSystem`. `_get_s3_path()`: returns `bucket/key`. Opens via `self.s3.open()` | `__init__`: reads `BASE_DIR` from env. `_get_file_path()`: returns `BASE_DIR / key`. Opens via `h5py.File(path)` |
| `backend/src/routes/files.py` | Uses `MinIOClient.list_objects()` (boto3) | Uses `Path.rglob()` or `os.walk()` |
| `backend/src/storage/` | `minio_client.py` (boto3 wrapper) | `local_client.py` (filesystem wrapper) |
| File browser UI | H5API `index.html` with S3 browse. `goToFile()` sends `?file=&bucket=` | Custom page with filesystem listing. `goToFile()` sends `?file=` only |

### Lines of change: ~50 lines across 2-3 backend files

### old_web changes: **Zero**

The `?bucket=` param is optional. If not sent, backend uses its default. On a filesystem setup, there is no bucket — just the relative path in `?file=`.

---

## Why This Works

```
h5py.File() accepts:
  ├── str path       →  "/mnt/hdf5/data.h5"           (filesystem)
  ├── file-like obj  →  s3fs.open("bucket/data.h5")    (S3/MinIO)
  └── file-like obj  →  any IO stream                  (custom storage)

Everything AFTER h5py.File() is opened is identical:
  hdf["/dataset"][:100]     ← same
  hdf["/group"].keys()      ← same
  hdf["/dataset"].shape     ← same
  hdf["/dataset"].dtype     ← same
```

The entire preview engine, matrix block loader, line chart renderer, heatmap builder, metadata extractor, CSV exporter — all operate on h5py objects. They never touch storage.

---

## Summary

| Question | Answer |
|----------|--------|
| Is backend tied to S3? | No. Only ~50 lines in 2 files handle S3. |
| Does swapping storage break old_web? | No. old_web only talks REST API. |
| Does swapping storage change API contracts? | No. Same endpoints, same JSON. |
| What's the minimum change for a new storage backend? | 1) How to open the file → `h5py.File(...)`. 2) How to list files. |
