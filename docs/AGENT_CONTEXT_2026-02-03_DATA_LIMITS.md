# AGENT CONTEXT — 2026-02-03 — Data Limits Enforcement

- Implemented /data limit validation in `backend/src/routes/hdf5.py`.
- Added hard limits: max elements, matrix row/col ceilings, max line points, max heatmap size.
- Added parameter parsing helpers and selection validation before any data reads.
- /data currently validates limits and returns 501 (not implemented) after passing checks.
