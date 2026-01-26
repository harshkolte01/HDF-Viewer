# HDF Viewer Backend

A minimal Python backend for the HDF Viewer application.

## Features

- ✅ Environment variable loading from `.env`
- ✅ Structured logging with configurable levels
- ✅ CORS support with configurable origins
- ✅ Health check endpoint
- ✅ MinIO/S3 client integration for file storage

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   - Edit `.env` file with your configuration
   - Required variables:
     - `HOST=0.0.0.0` - Server host
     - `PORT=5000` - Server port
     - `DEBUG=True` - Debug mode
     - `CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080` - Allowed CORS origins
     - `S3_ENDPOINT` - MinIO/S3 endpoint URL
     - `S3_REGION` - S3 region (default: us-east-1)
     - `S3_ACCESS_KEY` - MinIO/S3 access key
     - `S3_SECRET_KEY` - MinIO/S3 secret key
     - `S3_BUCKET` - Bucket name

## Running the Server

```bash
python app.py
```

The server will start on `http://0.0.0.0:5000`

## API Endpoints

### Health Check
- **URL:** `/health`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-01-26T09:28:39.123456",
    "service": "HDF Viewer Backend"
  }
  ```

### List Files
- **URL:** `/files`
- **Method:** `GET`
- **Description:** Lists all files in the configured MinIO bucket **with caching (30s TTL)**
- **Response:**
  ```json
  {
    "success": true,
    "count": 2,
    "files": [
      {
        "key": "example.hdf5",
        "size": 1024000,
        "last_modified": "2026-01-26T09:30:00.000000",
        "etag": "abc123def456"
      }
    ],
    "cached": false
  }
  ```

### Refresh Files Cache
- **URL:** `/files/refresh`
- **Method:** `POST`
- **Description:** Manually clear the files list cache
- **Response:**
  ```json
  {
    "success": true,
    "message": "Cache cleared successfully"
  }
  ```

### Get HDF5 Children
- **URL:** `/files/<key>/children?path=<hdf5_path>`
- **Method:** `GET`
- **Description:** Get children (groups/datasets) at a specific path in an HDF5 file. **Cached by (key, etag, path)**
- **Parameters:**
  - `path` (query): HDF5 internal path (default: `/` for root)
- **Example:** `/files/data.hdf5/children?path=/group1`
- **Response:**
  ```json
  {
    "success": true,
    "key": "data.hdf5",
    "path": "/group1",
    "children": [
      {
        "name": "dataset1",
        "path": "/group1/dataset1",
        "type": "dataset",
        "shape": [1000, 100],
        "dtype": "float64",
        "size": 100000
      },
      {
        "name": "subgroup",
        "path": "/group1/subgroup",
        "type": "group",
        "num_children": 5
      }
    ],
    "cached": false
  }
  ```

### Get HDF5 Metadata
- **URL:** `/files/<key>/meta?path=<hdf5_path>`
- **Method:** `GET`
- **Description:** Get detailed metadata for a specific dataset/group. **Cached by (key, etag, path)**
- **Parameters:**
  - `path` (query, required): HDF5 internal path
- **Example:** `/files/data.hdf5/meta?path=/group1/dataset1`
- **Response:**
  ```json
  {
    "success": true,
    "key": "data.hdf5",
    "metadata": {
      "name": "dataset1",
      "path": "/group1/dataset1",
      "type": "dataset",
      "shape": [1000, 100],
      "dtype": "float64",
      "size": 100000,
      "ndim": 2,
      "chunks": [100, 100],
      "compression": "gzip",
      "attributes": {
        "units": "meters",
        "description": "Sample dataset"
      },
      "num_attributes": 2
    },
    "cached": false
  }
  ```

### Benchmark Performance
- **URL:** `/benchmark`
- **Method:** `GET`
- **Description:** Runs performance benchmarks on MinIO operations to validate latency expectations
- **Response:**
  ```json
  {
    "success": true,
    "results": {
      "list_objects": {
        "average_ms": 45.2,
        "min_ms": 42.1,
        "max_ms": 48.3,
        "object_count": 10,
        "assessment": "instant"
      },
      "head_request": {
        "average_ms": 12.5,
        "min_ms": 11.2,
        "max_ms": 14.1,
        "test_object": "example.hdf5",
        "assessment": "instant"
      },
      "range_read": {
        "average_ms": 85.3,
        "min_ms": 82.1,
        "max_ms": 89.5,
        "chunk_size_bytes": 10240,
        "test_object": "large_file.hdf5",
        "throughput_kbps": 117.5,
        "assessment": "fast"
      }
    },
    "recommendations": {
      "cache_file_list": false,
      "cache_metadata": false,
      "optimize_chunking": false
    }
  }
  ```

## Performance Benchmarking

### Using the API Endpoint
The `/benchmark` endpoint runs quick performance tests and returns results via HTTP:
```bash
curl http://localhost:5000/benchmark
```

### Using the Standalone Script
For more detailed benchmarking with console output:
```bash
python benchmark.py
```

This script measures:
1. **List Objects**: How long it takes to list all files in the bucket
2. **HEAD Request**: Latency for fetching object metadata
3. **Range Read**: Throughput for reading small chunks from large files

The results help determine:
- Whether "instant" responses are realistic without caching
- If caching strategies are needed for file lists or metadata
- Expected performance for streaming HDF5 data chunks

## MinIO Client Module

The `minio_client.py` module provides a simple interface for MinIO/S3 operations:

- **`list_objects(prefix="")`** - List all objects in the bucket with optional prefix filter
- **`get_object_metadata(key)`** - Get metadata for a specific object using HEAD request
- **`get_object_range(key, start, end)`** - **[CRITICAL FOR HDF5]** Read specific byte range using HTTP Range requests
- **`open_object_stream(key)`** - Open object as stream (fetches entire object, not recommended for HDF5)

### ⚠️ Important: Range Requests for HDF5

For HDF5 random access, you **must** use `get_object_range()`, not `open_object_stream()`.

**Why?**
- HDF5 requires random seeks into different parts of the file
- `get_object_range()` uses HTTP Range GET requests (only fetches requested bytes)
- `open_object_stream()` fetches the entire object (wasteful for large files)

**Example:**
```python
# ✓ CORRECT: Read HDF5 superblock (first 512 bytes)
data = minio.get_object_range('file.hdf5', 0, 511)

# ✗ WRONG: Fetches entire file just to read 512 bytes
stream = minio.open_object_stream('file.hdf5')
data = stream.read(512)
```

### Verifying Range Request Support

Run the verification script to ensure HTTP Range requests are working:

```bash
# Simple verification (clean output)
python verify_range_requests.py

# Detailed verification (shows HTTP headers)
python verify_range_requests.py
# Then choose option 1
```

You should see `Range: bytes=X-Y` headers in the HTTP requests. If you don't, HDF5 browsing will be slow.

## Testing

Test the health endpoint:
```bash
curl http://localhost:5000/health
```

Test the files endpoint:
```bash
curl http://localhost:5000/files
```
