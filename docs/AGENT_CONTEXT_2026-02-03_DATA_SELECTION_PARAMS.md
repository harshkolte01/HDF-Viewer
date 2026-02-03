# AGENT CONTEXT — 2026-02-03 — Data Selection Params

- Updated `/data` contract in `backend/docs/BACKEND.md` to align selection parameters:
  - Validated distinct `display_dims` rule.
  - Matrix paging uses `row_offset/row_limit` and `col_offset/col_limit`.
  - Line selection uses `line_dim` and `line_index` with `fixed_indices` for nD.
- Normalized headings to ASCII dashes.
- No backend code changes.
