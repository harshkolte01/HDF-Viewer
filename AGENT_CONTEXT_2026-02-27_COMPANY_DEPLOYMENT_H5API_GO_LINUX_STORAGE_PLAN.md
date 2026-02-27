# AGENT CONTEXT - 2026-02-27 - Company Deployment Plan (H5API Go + old_web + Linux Storage)

## Your Requirement
- Company has an H5 file listing UI (like `H5API`) with a `Go` button.
- On `Go`, `old_web` viewer should open for that file.
- Backend should load file data correctly from company storage (Linux storage server).
- You asked if current setup is correct and what changes are needed, especially for `/mnt/path` style storage.

---

## Correctness Verdict (Current Setup)

## What is already correct
- `H5API` Go flow is wired:
  - `H5API/templates/index.html` opens `VIEWER_BASE/?file=<key>&bucket=<bucket>`.
- `old_web` deep-link is wired:
  - `old_web/js/app.js` reads `?file=` and `?bucket=`, then opens viewer state.
- Viewer-to-backend API calls are wired:
  - `/files/<key>/children|meta|preview|data|export/csv`.

## Where current setup is not enough
- Backend reader is currently S3/MinIO based (`s3fs + bucket/key`), not direct Linux filesystem.
- If company sends raw Linux path (`/mnt/path/...`) or custom URL directly, current backend will not reliably load it unless storage adapter logic is added.

## Final verdict
- `Setup is correct` for S3/MinIO object-key flow.
- `Setup is not fully correct yet` for direct Linux storage path flow.

---

## Recommended Production Architecture (for Company Linux Storage)

1. Deploy backend near storage server with mount access:
   - Example mount: `/mnt/hdf5_data`
2. Keep frontend file identifier as a relative key, not absolute path:
   - Good: `projectA/run1/file01.h5`
   - Avoid exposing: `/mnt/hdf5_data/projectA/run1/file01.h5`
3. Backend resolves key to absolute path internally:
   - `resolved = /mnt/hdf5_data + key`
4. `H5API Go` should pass only safe key (and optional source flag), then open `old_web`.

This keeps UI simple, avoids leaking server filesystem layout, and is safer.

---

## Required Changes

## 1) Backend storage mode support
- Add env-driven storage mode:
  - `STORAGE_MODE=s3` (current) or `STORAGE_MODE=local`
  - `HDF5_BASE_DIR=/mnt/hdf5_data` for local mode

## 2) Reader abstraction update
- In `backend/src/readers/hdf5_reader.py`:
  - Replace hard-only `self.s3.open(...)` usage with unified opener:
    - S3 mode: existing behavior
    - Local mode: `open(<resolved local file>, 'rb')`

## 3) File listing adapter update
- In `backend/src/storage/`:
  - Keep `minio_client.py` for S3 mode.
  - Add local filesystem client (`local_client.py`) for `/mnt/...` listing.
- In `backend/src/routes/files.py`:
  - Resolve client by storage mode.

## 4) Security hardening for local paths
- Never trust incoming file key as raw path.
- Normalize and validate key:
  - disallow `..`
  - resolve path and enforce it stays under `HDF5_BASE_DIR`
- Reject traversal attempts with `400`.

## 5) H5API Go payload
- If company listing source is filesystem-based:
  - Pass relative key (`?file=projectA/run1/file01.h5`)
  - Optional: pass `?source=local` if multi-source support is needed.

## 6) old_web changes (minimal)
- Current `?file` deep-link is already implemented.
- Only needed if multi-source is introduced:
  - store `selectedSource`
  - send `source` in API query params.

---

## If Company Forces Absolute `/mnt/path` in Go URL

You can support it, but it is not recommended. If unavoidable:
- Add backend mapping rule:
  - Accept absolute path input only if it starts with allowed base dirs.
- Strongly validate against:
  - traversal
  - symlink escape
  - unauthorized directories.

Recommended safer alternative:
- Convert absolute path to relative key in listing service before sending `Go`.

---

## Deployment Checklist

1. Backend host can read mounted storage path:
   - `/mnt/hdf5_data`
2. Backend env:
   - `STORAGE_MODE=local`
   - `HDF5_BASE_DIR=/mnt/hdf5_data`
3. `old_web/config/runtime-config.js` points to company backend URL.
4. `H5API` `VIEWER_BASE` points to deployed `old_web`.
5. Smoke test:
   - Click `Go` from listing -> viewer opens dataset tree.
   - Verify `children`, `preview`, `data`, `export/csv` work.

---

## Practical Answer
- For your company scenario with Linux storage server, your current integration flow is directionally correct, but backend storage access layer must be extended to local filesystem mode (`/mnt/path`) for full correctness.
- After the above changes, `Go` flow will work exactly as you expect.
