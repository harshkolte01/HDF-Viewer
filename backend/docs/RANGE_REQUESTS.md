# HTTP Range Request Support for HDF5

## The Problem

HDF5 files require **random access** to different parts of the file:
- Reading the superblock (first 512 bytes)
- Jumping to dataset metadata (could be anywhere in the file)
- Reading data chunks (scattered throughout the file)

If your storage client doesn't support HTTP Range requests, it will fetch the **entire file** every time you want to read a small chunk. For a 1GB HDF5 file, this means downloading 1GB just to read 512 bytes!

## The Solution: HTTP Range GET

HTTP Range requests allow you to fetch **only the bytes you need**:

```http
GET /bucket/file.hdf5 HTTP/1.1
Range: bytes=0-511
```

This fetches only bytes 0-511, not the entire file.

## Implementation

### ✅ Added: `get_object_range()` Method

```python
def get_object_range(self, key: str, start: int, end: int) -> bytes:
    """
    Read a specific byte range from an object using HTTP Range requests
    
    Args:
        key: Object key/path
        start: Starting byte position (inclusive, 0-indexed)
        end: Ending byte position (inclusive)
        
    Returns:
        Bytes read from the specified range
    """
    range_header = f"bytes={start}-{end}"
    
    response = self.client.get_object(
        Bucket=self.bucket,
        Key=key,
        Range=range_header  # ← This is the critical parameter
    )
    
    return response['Body'].read()
```

### ⚠️ Warning: `open_object_stream()` 

The existing `open_object_stream()` method does **NOT** use Range requests:

```python
# This fetches the ENTIRE object
response = self.client.get_object(Bucket=self.bucket, Key=key)
stream = response['Body']
```

Even if you only read 512 bytes from the stream, MinIO has already sent the entire file.

## Usage Comparison

### ❌ WRONG: Full Object Fetch
```python
# Downloads entire 1GB file
stream = minio.open_object_stream('large_file.hdf5')
data = stream.read(512)  # Only uses 512 bytes, wastes 1GB download
```

### ✅ CORRECT: Range Request
```python
# Downloads only 512 bytes
data = minio.get_object_range('large_file.hdf5', 0, 511)
```

## Verification

### How to Verify Range Requests Are Working

Run the verification script:
```bash
python verify_range_requests.py
```

**What to look for:**

1. **In detailed mode (option 1):** You should see boto3 debug logs showing:
   ```
   Range: bytes=0-511
   Range: bytes=1024-2047
   ```

2. **In MinIO server logs:** You should see requests with Range headers:
   ```
   GET /bucket/file.hdf5?Range=bytes%3D0-511
   ```

3. **Response status:** Should be `206 Partial Content`, not `200 OK`

### If Range Requests Are NOT Working

You'll see:
- ❌ No `Range:` headers in HTTP requests
- ❌ Response status `200 OK` instead of `206 Partial Content`
- ❌ Full object size being transferred for small reads
- ❌ Slow performance for large files

## Performance Impact

### Without Range Requests (Full Object Fetch)
- **File size:** 1 GB
- **Bytes needed:** 512 bytes
- **Bytes transferred:** 1 GB ❌
- **Time:** ~10-30 seconds (depending on network)

### With Range Requests
- **File size:** 1 GB
- **Bytes needed:** 512 bytes
- **Bytes transferred:** 512 bytes ✓
- **Time:** ~50-200ms (depending on network)

**Speed improvement:** 100-500x faster! 🚀

## HDF5 Access Pattern Example

Typical HDF5 file opening sequence:
```python
# 1. Read superblock (first 512 bytes)
superblock = minio.get_object_range(key, 0, 511)

# 2. Parse superblock to find B-tree location (e.g., byte 50000)
btree = minio.get_object_range(key, 50000, 51023)

# 3. Parse B-tree to find dataset location (e.g., byte 2000000)
dataset_header = minio.get_object_range(key, 2000000, 2001023)

# 4. Read actual data chunk (e.g., byte 5000000)
data = minio.get_object_range(key, 5000000, 5102399)
```

Without Range requests, each of these would download the **entire 1GB file** = 4GB total transfer!

With Range requests: Only ~4KB total transfer ✓

## Files Modified

1. ✅ `minio_client.py` - Added `get_object_range()` method
2. ✅ `verify_range_requests.py` - Verification script
3. ✅ `README.md` - Documentation and usage examples

## Next Steps

1. ✅ Run `python verify_range_requests.py` to confirm Range support
2. ✅ Use `get_object_range()` for all HDF5 file access
3. ✅ Never use `open_object_stream()` for HDF5 files

This is **critical** for acceptable HDF5 browsing performance!
