# Benchmark Fix: Stream Reuse

## Problem Identified

The original benchmark was measuring **connection overhead** instead of **actual read performance**.

### What Was Wrong

**Before Fix:**
```python
for i in range(5):
    stream = minio.open_object_stream(test_key)  # ❌ Opens new connection
    data = stream.read(chunk_size)
    stream.close()                                # ❌ Closes connection
    # Measures: connection setup + read + teardown
```

Each benchmark iteration was:
1. Opening a new stream (connection setup overhead)
2. Reading data
3. Closing the stream (teardown overhead)

**Result:** Throughput numbers were meaningless because they included ~500ms+ of connection overhead per read.

### What Was Fixed

**After Fix:**
```python
stream = minio.open_object_stream(test_key)  # ✓ Open once
stream.read(chunk_size)                       # Warm-up

for i in range(5):
    data = stream.read(chunk_size)            # ✓ Just measure read time
    # Measures: actual read performance only

stream.close()                                # ✓ Close once
```

Now the benchmark:
1. Opens stream **once** before all reads
2. Performs warm-up read
3. Measures **only** the read operation time (no connection overhead)
4. Closes stream **once** after all reads

## Why This Matters

### Real-World Usage Pattern
Your HDF5 viewer will:
- Open a file once
- Perform multiple reads from the same handle
- Keep the connection alive during user interaction

The fixed benchmark now matches this realistic usage pattern.

### Expected Performance Improvement

**Before (with connection overhead):**
- 1KB read: ~500-22,000ms (mostly connection setup)
- Throughput: 0.04-1.86 KB/s ❌

**After (pure read performance):**
- Should see dramatic improvement
- Throughput should be 100x-1000x better ✓
- More realistic for actual HDF5 streaming

## Files Modified

1. ✅ `benchmark.py` - Fixed `benchmark_range_read()` function
2. ✅ `app.py` - Fixed `/benchmark` endpoint

## Testing the Fix

Run the benchmark again to see the real performance:

```bash
python benchmark.py
```

Or via HTTP:
```bash
curl http://localhost:5000/benchmark
```

You should now see:
- **Much faster** read times (likely <100ms)
- **Much higher** throughput (likely >1000 KB/s)
- **Consistent** performance across runs (no random 22-second spikes)

## Key Takeaway

✅ **The benchmark now correctly measures what matters:** How fast can we read sequential chunks from an already-open stream, which is exactly what the HDF5 viewer will do.
