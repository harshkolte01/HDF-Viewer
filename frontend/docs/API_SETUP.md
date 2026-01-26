# Frontend API Setup

## Overview

The frontend uses a clean, modular API structure for communicating with the HDF5 Viewer backend.

## Structure

```
src/api/
├── config.js          # API configuration and endpoints
├── client.js          # HTTP client with error handling
├── hdf5Service.js     # HDF5-specific API methods
└── index.js           # Central exports
```

## Configuration

### Environment Variables

Create a `.env` file in the frontend root (use `.env.example` as template):

```env
VITE_API_BASE_URL=http://localhost:5000
```

**Note:** `.env` is gitignored. Never commit it!

### API Endpoints

All endpoints are defined in `src/api/config.js`:

```javascript
import { API_ENDPOINTS } from '@/api';

// Available endpoints:
API_ENDPOINTS.HEALTH              // /health
API_ENDPOINTS.FILES               // /files
API_ENDPOINTS.FILES_REFRESH       // /files/refresh
API_ENDPOINTS.FILE_CHILDREN(key)  // /files/{key}/children
API_ENDPOINTS.FILE_META(key)      // /files/{key}/meta
API_ENDPOINTS.BENCHMARK           // /benchmark
```

## Usage

### Basic Usage

```javascript
import { getFiles, getFileChildren, getFileMeta } from '@/api';

// Get all files
const { files } = await getFiles();

// Get children of a path
const { children } = await getFileChildren('data.hdf5', '/arrays');

// Get metadata
const { metadata } = await getFileMeta('data.hdf5', '/arrays/array_2d');
```

### Error Handling

```javascript
import { getFiles, ApiError } from '@/api';

try {
  const data = await getFiles();
  console.log(data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Data:', error.data);
  } else {
    console.error('Network Error:', error.message);
  }
}
```

### In React Components

```javascript
import { useState, useEffect } from 'react';
import { getFiles } from '@/api';

function FileList() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true);
        const data = await getFiles();
        setFiles(data.files);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {files.map(file => (
        <li key={file.key}>{file.key}</li>
      ))}
    </ul>
  );
}
```

## Available Methods

### File Management

#### `getFiles()`
Get list of all HDF5 files.

**Returns:**
```javascript
{
  success: true,
  count: 7,
  files: [
    {
      key: "data.hdf5",
      size: 901209716,
      last_modified: "2026-01-10T12:43:17.339000+00:00",
      etag: "fa3cf99d9bef27db0e25a8a2965edc2e"
    }
  ],
  cached: false
}
```

#### `refreshFiles()`
Manually refresh the files cache.

**Returns:**
```javascript
{
  success: true,
  message: "Cache cleared successfully"
}
```

### HDF5 Navigation

#### `getFileChildren(key, path = '/')`
Get children at a specific path in an HDF5 file.

**Parameters:**
- `key` (string): File key/name
- `path` (string): HDF5 internal path (default: '/')

**Returns:**
```javascript
{
  success: true,
  key: "data.hdf5",
  path: "/arrays",
  children: [
    {
      name: "array_2d",
      path: "/arrays/array_2d",
      type: "dataset",
      shape: [20000, 2500],
      dtype: "float32",
      size: 50000000,
      ndim: 2,
      chunks: [500, 500],
      compression: "gzip"
    }
  ],
  cached: false
}
```

#### `getFileMeta(key, path)`
Get detailed metadata for a specific path.

**Parameters:**
- `key` (string): File key/name
- `path` (string): HDF5 internal path (required)

**Returns:**
```javascript
{
  success: true,
  key: "data.hdf5",
  metadata: {
    name: "array_2d",
    path: "/arrays/array_2d",
    type: "dataset",
    shape: [20000, 2500],
    dtype: "float32",
    size: 50000000,
    ndim: 2,
    chunks: [500, 500],
    compression: "gzip",
    attributes: {},
    num_attributes: 0
  },
  cached: false
}
```

### Utilities

#### `checkHealth()`
Check backend server health.

**Returns:**
```javascript
{
  status: "healthy",
  timestamp: "2026-01-26T10:46:35.740061",
  service: "HDF Viewer Backend"
}
```

#### `runBenchmark()`
Run performance benchmarks (optional).

## Advanced Usage

### Custom Requests

```javascript
import { get, post } from '@/api/client';

// Custom GET request
const data = await get('/custom/endpoint', { param: 'value' });

// Custom POST request
const result = await post('/custom/endpoint', { data: 'value' });
```

### Direct Client Usage

```javascript
import client from '@/api/client';

// Use the client directly
const response = await client.get('/endpoint');
const response = await client.post('/endpoint', { data });
const response = await client.put('/endpoint', { data });
const response = await client.delete('/endpoint');
```

## Testing

```javascript
import { checkHealth } from '@/api';

// Test backend connection
async function testConnection() {
  try {
    const health = await checkHealth();
    console.log('Backend is healthy:', health);
    return true;
  } catch (error) {
    console.error('Backend is down:', error.message);
    return false;
  }
}
```

## Best Practices

1. **Always handle errors** - Use try/catch or .catch()
2. **Show loading states** - Provide feedback during API calls
3. **Cache awareness** - Note the `cached` field in responses
4. **Type safety** - Consider adding TypeScript for better DX
5. **Environment variables** - Never hardcode API URLs

## Troubleshooting

### CORS Errors
- Ensure backend CORS is configured for `http://localhost:5173`
- Check `.env` has correct `VITE_API_BASE_URL`

### Network Errors
- Verify backend is running on port 5000
- Check `npm run dev` is running for frontend
- Test with `curl http://localhost:5000/health`

### Import Errors
- Use `@/api` alias or relative imports
- Ensure Vite is configured for path aliases

## Next Steps

- Create custom hooks (useFiles, useFileTree, etc.)
- Add request caching/deduplication
- Implement optimistic updates
- Add request cancellation for cleanup
