# Backend Project Structure

## Overview
Clean, organized backend structure following Python best practices.

## Directory Structure

```
backend/
├── app.py                      # Main Flask application (entry point)
├── .env                        # Environment configuration
├── requirements.txt            # Python dependencies
├── README.md                   # Documentation
│
├── src/                        # Source code
│   ├── __init__.py
│   │
│   ├── storage/                # Storage layer (MinIO/S3)
│   │   ├── __init__.py
│   │   └── minio_client.py     # MinIO client with Range request support
│   │
│   ├── readers/                # File format readers
│   │   ├── __init__.py
│   │   └── hdf5_reader.py      # HDF5 file reader with S3 support
│   │
│   ├── utils/                  # Utilities
│   │   ├── __init__.py
│   │   └── cache.py            # In-memory cache with TTL
│   │
│   └── routes/                 # API routes (Blueprints)
│       ├── __init__.py
│       ├── files.py            # File listing endpoints
│       └── hdf5.py             # HDF5 navigation endpoints
│
├── scripts/                    # Utility scripts
│   ├── benchmark.py            # Performance benchmarking
│   ├── test_minio.py           # MinIO connection test
│   └── verify_range_requests.py # Range request verification
│
└── docs/                       # Documentation (old files)
    ├── BENCHMARK_FIX.md
    ├── RANGE_REQUESTS.md
    ├── STEP_1.3_SUMMARY.md
    └── IMPLEMENTATION_PLAN.md
```

## Module Responsibilities

### `app.py`
- Flask application initialization
- CORS configuration
- Blueprint registration
- Health check endpoint
- **Keep this file minimal!**

### `src/storage/minio_client.py`
- MinIO/S3 client wrapper
- HTTP Range request support
- Object listing, metadata, range reads

### `src/readers/hdf5_reader.py`
- HDF5 file reading with S3 backend
- Lazy tree navigation
- Metadata extraction

### `src/utils/cache.py`
- Thread-safe in-memory cache
- TTL support
- Pattern-based clearing

### `src/routes/files.py`
- `/files` - List files (with caching)
- `/files/refresh` - Manual cache refresh

### `src/routes/hdf5.py`
- `/files/<key>/children` - Get HDF5 tree children
- `/files/<key>/meta` - Get HDF5 metadata

## Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

## Running Scripts

```bash
# From backend directory
python scripts/benchmark.py
python scripts/test_minio.py
python scripts/verify_range_requests.py
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### File Management
- `GET /files` - List all files (cached 30s)
- `POST /files/refresh` - Clear cache

### HDF5 Navigation
- `GET /files/<key>/children?path=<path>` - Get children at path
- `GET /files/<key>/meta?path=<path>` - Get metadata for path

## Key Features

✅ **Clean Separation**: Business logic separated from routes
✅ **Modular**: Easy to add new readers or storage backends
✅ **Caching**: Built-in with etag-based invalidation
✅ **Range Requests**: Optimized for large file access
✅ **Type Hints**: Better IDE support and code clarity
✅ **Logging**: Structured logging throughout

## Import Examples

```python
# In app.py
from src.routes.files import files_bp
from src.routes.hdf5 import hdf5_bp

# In routes
from src.storage.minio_client import get_minio_client
from src.readers.hdf5_reader import get_hdf5_reader
from src.utils.cache import get_hdf5_cache, make_cache_key

# In scripts
from src.storage.minio_client import get_minio_client
```

## Benefits of This Structure

1. **Maintainability**: Each module has a single responsibility
2. **Testability**: Easy to mock and test individual components
3. **Scalability**: Simple to add new features without cluttering app.py
4. **Clarity**: Clear separation between storage, business logic, and API
5. **Reusability**: Modules can be imported and used independently
