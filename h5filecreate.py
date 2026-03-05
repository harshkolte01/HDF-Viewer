import os
import numpy as np
import h5py

def create_h5(
    out_path="example_800mb.h5",
    # Use compression=None to better "control" file size.
    # If you enable compression, final size depends heavily on data entropy.
    compression=None,           # e.g. "gzip"
    compression_opts=None,      # e.g. 4
    seed=123,
):
    rng = np.random.default_rng(seed)

    # -----------------------------
    # Shapes chosen to land ~800MB (uncompressed)
    # You can adjust these if you want.
    #
    # Size math (approx):
    # - 2D float32:   12000 x 6000  = 72,000,000  * 4  ≈ 288 MB
    # - 3D int16:        300 x 512 x 512 = 78,643,200 * 2 ≈ 150 MB
    # - 4D float32:       32 x 64 x 256 x 256 = 134,217,728 * 4 ≈ 512 MB
    #   Total ≈ 950 MB
    #
    # We'll reduce the 4D a bit to get closer to ~800MB:
    # - 4D float32: 24 x 64 x 256 x 256 = 100,663,296 * 4 ≈ 384 MB
    # Total ≈ 288 + 150 + 384 = 822 MB (plus small overhead)
    # -----------------------------

    shape_2d = (12000, 6000)          # float32 ~288MB
    shape_3d = (300, 512, 512)        # int16   ~150MB
    shape_4d = (24, 64, 256, 256)     # float32 ~384MB

    # Chunk shapes (tune for your access pattern)
    chunks_2d = (256, 1024)
    chunks_3d = (1, 128, 128)
    chunks_4d = (1, 4, 64, 64)

    # Structured "table" dataset (compound dtype)
    table_dtype = np.dtype([
        ("id",   np.int64),
        ("x",    np.float32),
        ("y",    np.float32),
        ("cls",  np.int32),
        ("flag", np.int8),
    ])
    table_rows = 2_000_000  # ~2M rows. Each row is 8+4+4+4+1 = 21 bytes (+ alignment) ~24 bytes => ~48MB
    table_chunk = (100_000,)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    with h5py.File(out_path, "w") as f:
        # Helpful metadata
        f.attrs["created_by"] = "h5py"
        f.attrs["note"] = "2D/3D/4D datasets + compound table; mixed float/int; chunked writing"

        # Create groups (optional, but nice)
        g_arrays = f.create_group("arrays")
        g_table = f.create_group("tables")

        # Create datasets (empty initially, then fill chunk-by-chunk)
        d2 = g_arrays.create_dataset(
            "array_2d_float32",
            shape=shape_2d,
            dtype=np.float32,
            chunks=chunks_2d,
            compression=compression,
            compression_opts=compression_opts,
            shuffle=(compression is not None),
        )

        d3 = g_arrays.create_dataset(
            "array_3d_int16",
            shape=shape_3d,
            dtype=np.int16,
            chunks=chunks_3d,
            compression=compression,
            compression_opts=compression_opts,
            shuffle=(compression is not None),
        )

        d4 = g_arrays.create_dataset(
            "array_4d_float32",
            shape=shape_4d,
            dtype=np.float32,
            chunks=chunks_4d,
            compression=compression,
            compression_opts=compression_opts,
            shuffle=(compression is not None),
        )

        t1 = g_table.create_dataset(
            "events",
            shape=(table_rows,),
            dtype=table_dtype,
            chunks=table_chunk,
            compression=compression,
            compression_opts=compression_opts,
            shuffle=(compression is not None),
        )

        # -----------------------------
        # Fill 2D float32 in row blocks
        # -----------------------------
        block_rows = 256
        for r0 in range(0, shape_2d[0], block_rows):
            r1 = min(r0 + block_rows, shape_2d[0])
            # Random floats; change distribution as needed
            block = rng.standard_normal((r1 - r0, shape_2d[1]), dtype=np.float32)
            d2[r0:r1, :] = block

        # -----------------------------
        # Fill 3D int16 slice-by-slice
        # -----------------------------
        for i in range(shape_3d[0]):
            # Example: integers in range [-1000, 1000]
            slab = rng.integers(-1000, 1001, size=shape_3d[1:], dtype=np.int16)
            d3[i, :, :] = slab

        # -----------------------------
        # Fill 4D float32 in outer-dim blocks
        # -----------------------------
        for i in range(shape_4d[0]):
            # Create one "volume" at a time: (64, 256, 256)
            vol = rng.random((shape_4d[1], shape_4d[2], shape_4d[3]), dtype=np.float32)
            d4[i, :, :, :] = vol

        # -----------------------------
        # Fill table data in chunks
        # -----------------------------
        chunk = table_chunk[0]
        next_id = 0
        for p0 in range(0, table_rows, chunk):
            p1 = min(p0 + chunk, table_rows)
            n = p1 - p0

            arr = np.empty((n,), dtype=table_dtype)
            arr["id"] = np.arange(next_id, next_id + n, dtype=np.int64)
            arr["x"] = rng.standard_normal(n, dtype=np.float32)
            arr["y"] = rng.standard_normal(n, dtype=np.float32)
            arr["cls"] = rng.integers(0, 100, size=n, dtype=np.int32)
            arr["flag"] = rng.integers(0, 2, size=n, dtype=np.int8)

            t1[p0:p1] = arr
            next_id += n

        # Flush data
        f.flush()

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Created: {out_path}")
    print(f"File size: {size_mb:.1f} MB")

if __name__ == "__main__":
    # Uncompressed: predictable size near target
    create_h5(
        out_path="example_800mb.h5",
        compression=None,
        compression_opts=None,
    )

    # If you want compression (size will vary):
    # create_h5("example_compressed.h5", compression="gzip", compression_opts=4)