# AGENT CONTEXT — 2026-02-03 — Matrix Mode Implementation

- Implemented `/files/<key>/data` matrix mode in `backend/src/routes/hdf5.py` with limit checks and response payload.
- Added `get_matrix()` in `backend/src/readers/hdf5_reader.py` to extract 2D blocks using display dims + fixed indices.
- Added Phase 3 frontend integration plan doc in `frontend/docs/DATA_INTEGRATION_PLAN.md`.
- No other modes implemented yet.
