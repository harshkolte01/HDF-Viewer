# AGENT CONTEXT — 2026-02-03 — Data Response Formats

- Updated `/data` contract in `backend/docs/BACKEND.md` to define v1 JSON and future v2 binary response formats.
- Added required response fields: `data`, `shape` (returned block), `dtype`, `stats` (min/max for heatmap), and `downsample_info` (stride factors).
- Ensured metadata fields (`source_shape`, `source_ndim`, `display_dims`, `fixed_indices`) are included to avoid `/meta` re-calls.
- Fixed query parameter examples for `/children`, `/meta`, and `/preview`.
- No backend code changes.
