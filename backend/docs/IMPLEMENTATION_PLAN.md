# Step 1 Implementation Plan: HDF5 Endpoints with Caching

## Project Understanding

### Current State
- **Backend**: Flask server with MinIO client supporting HTTP Range requests
- **Frontend**: React + Vite (currently default template)
- **Storage**: MinIO S3-compatible storage with HDF5 files
- **Key Achievement**: HTTP Range GET working (verified ✓)

### Requirements Analysis

#### Endpoint 1: `/files` (Enhanced)
**Current**: Returns basic file list
**Required**: Add caching with 10-30 second TTL or manual refresh
**Response**: `{key, size, last_modified, etag}`
**Cache Strategy**: Time-based (30s) + manual invalidation

#### Endpoint 2: `/files/{key}/children?path=/`
**Purpose**: Lazy tree navigation - get children of a specific path in HDF5 file
**Response**: List of child groups/datasets at given path
**Cache Key**: `(key, etag, path)` - etag ensures cache invalidation on file change
**Example**: 
- `/files/data.hdf5/children?path=/` → root level groups
- `/files/data.hdf5/children?path=/group1` → children of group1

#### Endpoint 3: `/files/{key}/meta?path=...`
**Purpose**: Get metadata for a specific dataset/group
**Response**: Dataset shape, dtype, attributes (truncated if large)
**Cache Key**: `(key, etag, path)`
**Example**: `/files/data.hdf5/meta?path=/dataset1` → shape, dtype, attrs

### Technical Requirements

1. **HDF5 Library**: Need h5py with S3 support (h5py + s3fs or direct range reads)
2. **Caching**: Flask-Caching or simple in-memory dict with TTL
3. **Range Reads**: Use existing `get_object_range()` for HDF5 access
4. **Error Handling**: Graceful handling of invalid paths, corrupted files

### Architecture Decisions

#### Caching Strategy
```python
# Cache structure
cache = {
    'files': {
        'data': [...],
        'timestamp': datetime,
        'ttl': 30  # seconds
    },
    'children': {
        '(file.hdf5, etag123, /path)': {
            'data': [...],
            'timestamp': datetime
        }
    },
    'meta': {
        '(file.hdf5, etag123, /path)': {
            'data': {...},
            'timestamp': datetime
        }
    }
}
```

#### HDF5 Access Pattern
```python
# Option 1: h5py with fsspec (recommended)
import h5py
import s3fs

s3 = s3fs.S3FileSystem(...)
with h5py.File(s3.open(key, 'rb'), 'r') as f:
    # Access HDF5 structure

# Option 2: Download to temp, then open (fallback)
# Option 3: Custom HDF5 reader with range requests (complex)
```

### Implementation Steps

1. **Add Dependencies**
   - h5py
   - s3fs (for S3 file system support)
   - flask-caching (optional, can use simple dict)

2. **Create HDF5 Module** (`hdf5_reader.py`)
   - Open HDF5 files from S3
   - List children at path
   - Get metadata for path
   - Handle errors gracefully

3. **Create Cache Module** (`cache.py`)
   - Simple in-memory cache with TTL
   - Cache invalidation by etag
   - Manual refresh support

4. **Update API Routes** (`app.py`)
   - Enhance `/files` with caching
   - Add `/files/<key>/children`
   - Add `/files/<key>/meta`
   - Add `/files/refresh` for manual cache clear

5. **Testing**
   - Test with actual HDF5 files from MinIO
   - Verify cache hits on repeated requests
   - Verify etag-based invalidation

### Success Criteria

✓ `/files` returns cached results (30s TTL)
✓ `/files/{key}/children?path=/` returns HDF5 tree structure
✓ Repeated expands are instant (cache hits)
✓ Cache invalidates when file changes (etag check)
✓ Graceful error handling for invalid paths
✓ Logs show cache hits/misses

### Non-Goals (Not Implementing Yet)

✗ `/data` endpoint (data retrieval)
✗ Data visualization
✗ Frontend tree UI (focus on API first)
✗ Authentication/authorization
✗ Persistent cache (Redis, etc.)

## Next: Implementation
