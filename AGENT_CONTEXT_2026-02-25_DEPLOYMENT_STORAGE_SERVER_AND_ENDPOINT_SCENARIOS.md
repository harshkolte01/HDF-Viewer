# AGENT CONTEXT - 2026-02-25 - Deployment Plan for Storage Server vs External File Endpoint

## User Question
You asked what code changes are needed for two deployment cases:

1. Company connects a storage server to backend and backend fetches files.
2. Company gives a file endpoint, and users should select files from that endpoint.

This document maps the exact changes needed in this codebase (`backend` + `old_web`).

---

## Current Architecture (as-is)

### Backend coupling today
- `backend/src/storage/minio_client.py`
  - Hard-wired to S3/MinIO environment variables (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`).
- `backend/src/readers/hdf5_reader.py`
  - Hard-wired to `s3fs.S3FileSystem`.
- `backend/src/routes/files.py`
  - Imports `get_minio_client()` directly.
- `backend/src/routes/hdf5.py`
  - Imports `get_minio_client()` and `get_hdf5_reader()` directly.

### Frontend coupling today (`old_web`)
- Only one backend base URL (`window.__CONFIG__.API_BASE_URL` -> `old_web/js/config.js`).
- No concept of multiple file sources/endpoints.
- File list assumes a single `/files` provider.

---

## Case 1: Company Connects Storage Server to Backend

## A) If storage is S3-compatible (MinIO, AWS S3, Ceph S3)

### Required code changes
- **No backend code change required** for basic functionality.

### Required configuration only
- Set backend env:
  - `S3_ENDPOINT`
  - `S3_ACCESS_KEY`
  - `S3_SECRET_KEY`
  - `S3_BUCKET`
  - Optional: `S3_REGION`
- Set frontend runtime config:
  - `window.__CONFIG__.API_BASE_URL = "<your-backend-url>"`

### Optional but recommended hardening before company deployment
- Restrict CORS in `backend/app.py` (currently `origins="*"`).
- Add auth/authz at route level for `/files/*`.
- Add request logging correlation ID and rate limits.

## B) If storage is NOT S3-compatible (NFS/SMB/custom object API)

### Required code refactor
Introduce a **storage adapter interface** and switch routes/readers to provider-agnostic access.

### Files to add
- `backend/src/storage/base.py`
  - Define storage provider interface (list, metadata, open file stream).
- `backend/src/storage/provider_factory.py`
  - Resolve provider from env (ex: `STORAGE_PROVIDER=s3|filesystem|external_api`).
- `backend/src/storage/filesystem_client.py` (if NFS/local mount needed).

### Files to modify
- `backend/src/routes/files.py`
  - Replace direct `get_minio_client()` with `get_storage_provider()`.
- `backend/src/routes/hdf5.py`
  - Replace `get_minio_client()` metadata calls with provider metadata calls.
  - Include provider/source key in cache keys.
- `backend/src/readers/hdf5_reader.py`
  - Replace direct `s3fs` dependency with provider-based file open.
  - Reader should open via provider stream instead of building `bucket/key` itself.

---

## Case 2: Company Provides External File Endpoint

This case needs real code changes in both backend and frontend.

## Goal
Support one or more external file catalogs/endpoints and let user choose source before browsing/opening files.

## Backend changes

### 1) Add source-aware storage/provider model
- New env strategy:
  - `FILE_SOURCE_MODE=s3|external_api|hybrid`
  - `FILE_SOURCES_JSON=<json config for one or many sources>`
- Provider interface methods (minimum):
  - `list_objects(prefix, include_folders, max_items)`
  - `get_object_metadata(key)`
  - `open_hdf5_stream(key)`
  - `source_id` (stable identifier)

### 2) Add external endpoint provider
- New file: `backend/src/storage/external_endpoint_client.py`
- Responsibilities:
  - Call company file endpoint (catalog).
  - Normalize payload to existing frontend contract (`key`, `size`, `etag`, `type`, `is_folder`).
  - Open remote file stream with seek/range support for `h5py`.

### 3) Make routes source-aware
- Modify `backend/src/routes/files.py`:
  - Add `source` query param.
  - Return `source_id` in each file item and response root.
- Modify `backend/src/routes/hdf5.py`:
  - Accept `source` query param for `children`, `meta`, `preview`, `data`, `export/csv`.
  - Resolve provider by `source`.
  - Add `source` into every cache key to avoid cross-source cache pollution.

### 4) Add discovery endpoint for frontend dropdown
- New route (recommended): `GET /sources`
- Returns available sources and labels for UI selection.

### 5) Keep existing route paths stable
- Keep `/files/...` paths unchanged so old integrations still work.
- Add source via query param to avoid breaking current frontend:
  - `/files?source=plant-a`
  - `/files/<key>/data?...&source=plant-a`

## Frontend (`old_web`) changes

### Files to modify
- `old_web/js/state/store.js`
  - Add `availableSources`, `selectedSource`.
- `old_web/js/state/reducers/filesActions.js`
  - `loadFiles()` must request files for selected source.
  - `openViewer()` should persist source along with file key.
- `old_web/js/api/hdf5Service.js`
  - Pass `source` in all API calls.
  - Add `source` into frontend cache keys (`files`, `tree`, `meta`, `preview`, `data`).
- `old_web/js/config.js`
  - Add `SOURCES_ENDPOINT` and source-aware URL helpers if needed.
- `old_web/js/views/homeView.js`
  - Add source selector (dropdown) above file table.
- `old_web/js/components/tableView.js`
  - Optional: render source badge/column for clarity.
- `old_web/js/utils/export.js`
  - Ensure CSV export URL appends `source` query param.

### New frontend API call
- Add `getSources()` in `old_web/js/api/hdf5Service.js`.
- Load sources during app bootstrap (`old_web/js/app.js`) before first `loadFiles()`.

---

## Contract Changes (Recommended, Backward-Compatible)

## New endpoint
`GET /sources`

Response example:
```json
{
  "success": true,
  "sources": [
    { "id": "s3-prod", "label": "S3 Production", "type": "s3", "default": true },
    { "id": "company-api-1", "label": "Company Endpoint 1", "type": "external_api", "default": false }
  ]
}
```

## Existing endpoint extension
`GET /files?source=<source_id>`

Response example:
```json
{
  "success": true,
  "source": "company-api-1",
  "files": [
    {
      "key": "Folder_1/random_05.h5",
      "size": 425112,
      "last_modified": "2026-02-25T10:20:30Z",
      "etag": "9fbc...",
      "type": "file",
      "is_folder": false,
      "source_id": "company-api-1"
    }
  ]
}
```

All HDF5 routes keep current path and add query param `source`.

---

## Implementation Order (Safe Rollout)

1. Backend provider abstraction + factory (no frontend changes yet).
2. S3 provider moved to new abstraction (existing behavior unchanged).
3. External endpoint provider + `/sources` endpoint.
4. Add `source` query support to `/files` and `/files/<key>/*`.
5. Update `old_web` with source selector and source-aware API/cache keys.
6. Add tests for source-specific cache keys and source routing.

---

## Test Coverage to Add

## Backend
- `files.py`: list files by `source`, invalid source handling.
- `hdf5.py`: same key/path from different sources must not share cache entries.
- `hdf5.py`: `source` forwarded to export route.
- provider tests: external endpoint errors/timeouts/auth failures.

## Frontend (`old_web`)
- `hdf5Service.js`: cache keys include source.
- `filesActions.js`: switching source reloads file list and clears viewer-dependent cache.
- `export.js`: generated URL includes source.

---

## Final Answer to Your Deployment Concern

1. **Case 1 (S3-compatible storage server):** mostly configuration only, no major code rewrite.
2. **Case 2 (company file endpoint):** requires provider abstraction in backend and source-selection flow in `old_web`.
3. Best long-term design is **source-aware, provider-agnostic backend** with a small `GET /sources` contract and `source` query parameter across existing file routes.

