# js/api

Backend communication layer for old_web.

## Files and Responsibilities

- `client.js`
  - Base request wrapper around `fetch`.
  - Handles query serialization, abort linking, in-flight cancellation, and normalized `ApiError` objects.
- `contracts.js`
  - Normalizes backend payloads for files, children, metadata, preview, and data endpoints.
  - Provides `assertSuccess(...)` for consistent failure handling.
- `hdf5Service.js`
  - High-level API used by state/actions and runtimes.
  - Adds frontend cache strategy (Map + LRU), stale-while-refresh preview behavior, and mode-based data fetchers.
- `config.js`
  - Re-exports base API config from `old_web/js/config.js` for compatibility.

## Imported By

- `old_web/js/state/reducers.js` imports `getFiles`, `refreshFiles`, `getFileChildren`, `getFileMeta`, `getFilePreview` from `hdf5Service.js`.
- Runtime modules import `getFileData` from `hdf5Service.js`.
- Runtime modules import `cancelPendingRequest` from `client.js` when cancel channels are needed.

## External Dependency

- Depends on `old_web/js/config.js` for `API_BASE_URL` and endpoint paths.
