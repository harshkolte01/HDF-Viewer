# js/api

Backend communication layer for `old_web`.

## Files

- `client.js`
- Fetch wrapper, query serialization, cancel channels, `ApiError` normalization.
- `contracts.js`
- Normalizers for `/files`, `/children`, `/meta`, `/preview`, `/data` payloads.
- `hdf5Service.js`
- High-level API used by state actions and runtimes.
- Includes frontend caches, in-flight de-dup, and stale-while-refresh preview support.
- `config.js`
- Compatibility re-export of app config.

## Main Exports Used by App

- `getFiles`, `refreshFiles`
- `getFileChildren`
- `getFileMeta`
- `getFilePreview`
- `getFileData`
- `clearFrontendCaches`

## Cache Strategy (`hdf5Service.js`)

- Files: singleton cache
- Tree children: per-file map
- Preview: per-selection cache (+ optional background refresh)
- Matrix blocks: LRU cache
- Line windows: LRU cache
- Heatmap payloads: LRU cache
- Metadata: LRU cache
- In-flight request maps for de-dup + cancellation

## `/data` Routing

`getFileData()` dispatches by `params.mode`:

- `matrix` -> block window request
- `line` -> line window request
- `heatmap` -> heatmap request

## Line Compare Integration

- No new backend endpoint was added for compare V1.
- `lineRuntime.js` issues multiple `getFileData(... mode=line ...)` requests in parallel for base + compare datasets.
- Responses are handled via `Promise.allSettled` so partial failures do not break base rendering.
