# js/api

Backend communication layer for `old_web`.

## Files

- `client.js`
  - Fetch wrapper, query serialization, cancel channels, `ApiError` normalization.
- `contracts.js`
  - Normalizers for `/files`, `/children`, `/meta`, `/preview`, `/data` payloads.
- `hdf5Service.js`
  - High-level API used by actions/runtimes.
  - Adds frontend caches, in-flight de-duplication, and stale-while-refresh preview support.
- `config.js`
  - Compatibility re-export of app config.

## Main Exports Used by App

- `getFiles`, `refreshFiles`
- `getFileChildren`
- `getFileMeta`
- `getFilePreview`
- `getFileData`
- `clearFrontendCaches`

## Cache Strategy Implemented (`hdf5Service.js`)

- Files: singleton cache.
- Tree children: per-file map.
- Preview: per selection key map + optional background refresh.
- Matrix blocks: LRU cache.
- Line windows: LRU cache.
- Heatmap payloads: LRU cache.
- Metadata: LRU cache.
- In-flight request maps for de-dup and cancellation.

## Routing to `/data`

`getFileData()` dispatches by `params.mode`:

- `matrix` -> block window request
- `line` -> line window request
- `heatmap` -> heatmap request
