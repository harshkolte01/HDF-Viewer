# js/api

Backend communication layer for `old_web`.

## Files

- `client.js`: fetch wrapper, query serialization, `ApiError` normalization, cancel channels.
- `contracts.js`: payload normalizers for files/tree/meta/preview/data APIs.
- `hdf5Service.js`: high-level API consumed by state actions and viewer runtimes.
- `config.js`: compatibility re-export of app config.

## Main Exports Used by App

- `getFiles`, `refreshFiles`
- `getFileChildren`
- `getFileMeta`
- `getFilePreview`
- `getFileData`
- `clearFrontendCaches`

## Cache Strategy (`hdf5Service.js`)

- Files list: singleton cache
- Tree children: per-file map cache
- Preview payloads: keyed map with optional stale-while-refresh
- Matrix blocks: LRU
- Line ranges: LRU
- Heatmap payloads: LRU
- Metadata: LRU
- In-flight request maps for de-dup and cancellation

## `/data` Mode Routing

`getFileData()` routes by `params.mode`:
- `matrix` -> matrix block payload
- `line` -> line series payload
- `heatmap` -> heatmap matrix payload

## Line Compare and API Usage

- Compare mode reuses existing line `/data` requests for per-window plotting.
- Line runtime issues base and compare requests in parallel and handles partial failures.

## Export and API Usage

- Displayed exports are built client-side from runtime memory/cache.
- Full CSV export is not a `hdf5Service` method.
- Full CSV uses direct URL generation in `old_web/js/utils/export.js`:
- `GET /files/<key>/export/csv`
- Runtime modules attach mode-specific query params (`mode`, `display_dims`, `fixed_indices`, `line_dim`, `line_index`, `compare_paths`, etc.).
