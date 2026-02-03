# AGENT CONTEXT — 2026-02-03 — Data Heatmap Mode

- Implemented `/files/<key>/data` heatmap mode in `backend/src/routes/hdf5.py` with max_size cap and downsample info.
- Added `get_heatmap()` in `backend/src/readers/hdf5_reader.py` to extract a downsampled 2D plane and compute min/max for scaling.
- No frontend code changes.
