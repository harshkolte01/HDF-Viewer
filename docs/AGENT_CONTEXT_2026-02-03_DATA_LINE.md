# AGENT CONTEXT — 2026-02-03 — Data Line Mode

- Implemented `/files/<key>/data` line mode in `backend/src/routes/hdf5.py` with offset/limit handling and downsampling to max 5000 points.
- Added `get_line()` in `backend/src/readers/hdf5_reader.py` to extract 1D segments for 1D datasets, row/col profiles on 2D planes, and nD profiles along a chosen dim.
- Updated `/data` contract in `backend/docs/BACKEND.md` to document `line_offset` and `line_limit`.
- No frontend code changes.
