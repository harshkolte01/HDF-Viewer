# js/api

HTTP and contract layer for all backend communication.

## What is implemented
- `client.js`: fetch wrapper with abort support, cancel keys, and structured `ApiError` handling.
- `contracts.js`: schema normalization for files, tree children, metadata, preview, and mode data payloads.
- `hdf5Service.js`: API facade with frontend caching, stale-while-refresh preview updates, request dedupe, and mode routers.

## How it is implemented
- Requests are routed through `apiClient` and endpoint helpers from `core/config.js`.
- Responses are normalized before entering state to keep reducers and renderers deterministic.
- Multiple caches are used:
  file list/tree/preview caches, LRU caches for matrix blocks, line ranges, heatmap slices, and metadata.
- Mode-aware data fetch (`matrix`, `line`, `heatmap`) includes in-flight dedupe and cancellation channels.
