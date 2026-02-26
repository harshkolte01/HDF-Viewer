# H5API

A lightweight **Flask** microservice that connects to a **MinIO / S3** bucket and exposes an interactive, client-side **HDF5 file browser** — no frontend build step required.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Setup & Running](#setup--running)
4. [Environment Variables](#environment-variables)
5. [API Reference](#api-reference)
   - [GET `/`](#get-)
   - [GET `/api/browse`](#get-apibrowse)
   - [GET `/health`](#get-health)
6. [Response Schemas](#response-schemas)
7. [How It Works](#how-it-works)
8. [File Filtering](#file-filtering)

---

## Overview

H5API sits between your MinIO bucket and your browser. It uses **boto3** to list objects via S3's `list_objects_v2` API with a `/` delimiter — giving true virtual-folder navigation without any extra metadata storage.

```
Browser ──── GET /api/browse?prefix=<path> ──── H5API (Flask:5100) ──── MinIO S3
```

The HTML UI (`templates/index.html`) is a **fully client-side** single-page app. It fetches data from `/api/browse` via JavaScript, so it works whether served from Flask or a plain static server.

---

## Project Structure

```
H5API/
├── .env                  # MinIO credentials (not committed)
├── app.py                # Flask server — all logic lives here
├── requirements.txt      # Python dependencies
├── README.md             # This file
└── templates/
    └── index.html        # Client-side file browser UI (JS + CSS)
```

---

## Setup & Running

### 1. Install dependencies

```bash
cd H5API
pip install -r requirements.txt
```

### 2. Configure `.env`

```env
S3_ENDPOINT=http://your-minio-host:9200
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=hdf5files
```

### 3. Start the server

```bash
python app.py
```

Server starts at **http://localhost:5100** by default.

> **Note:** The HTML UI always calls the API at `http://localhost:5100`, so the Flask server must be running even if you open the HTML from a different server.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `S3_ENDPOINT` | ✅ | — | Full MinIO/S3 endpoint URL (e.g. `http://host:9200`) |
| `S3_REGION` | ❌ | `us-east-1` | AWS/MinIO region name |
| `S3_ACCESS_KEY` | ✅ | — | MinIO access key |
| `S3_SECRET_KEY` | ✅ | — | MinIO secret key |
| `S3_BUCKET` | ✅ | `hdf5files` | Name of the bucket containing HDF5 files |
| `HOST` | ❌ | `0.0.0.0` | Interface to bind the Flask server to |
| `PORT` | ❌ | `5100` | Port to listen on |
| `DEBUG` | ❌ | `false` | Enable Flask debug mode (`true` / `false`) |

---

## API Reference

### `GET /`

Serves the **HTML file browser UI** (`templates/index.html`).

The page uses JavaScript to call `/api/browse` and renders folders and files dynamically. No query parameters are needed — navigation state is handled entirely client-side.

**Response:** `text/html`

---

### `GET /api/browse`

Returns the **contents of a folder** (prefix) as JSON. This is the primary data endpoint used by the UI.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `prefix` | `string` | ❌ | `""` (root) | Virtual folder path within the bucket. Use `/`-separated segments (e.g. `experiments/run1`). Do **not** include a leading or trailing slash. |

#### Example Requests

```bash
# List root of bucket
curl http://localhost:5100/api/browse

# List a subfolder
curl http://localhost:5100/api/browse?prefix=experiments/run1
```

#### Success Response — `200 OK`

```json
{
  "success": true,
  "prefix": "experiments/run1",
  "total": 5,
  "breadcrumbs": [
    { "name": "Root",        "prefix": "" },
    { "name": "experiments", "prefix": "experiments" },
    { "name": "run1",        "prefix": "experiments/run1" }
  ],
  "folders": [
    {
      "key":  "experiments/run1/subgroup/",
      "name": "subgroup",
      "type": "folder"
    }
  ],
  "files": [
    {
      "key":           "experiments/run1/data.h5",
      "name":          "data.h5",
      "type":          "file",
      "size":          10485760,
      "last_modified": "2026-02-25T06:32:10+00:00"
    }
  ]
}
```

#### Error Response — `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Connection refused to MinIO endpoint"
}
```

#### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `success` | `bool` | `true` on success, `false` on error |
| `prefix` | `string` | The prefix that was queried |
| `total` | `int` | Total count of folders + files returned |
| `breadcrumbs` | `array` | Navigation trail from root to current prefix |
| `breadcrumbs[].name` | `string` | Display name of this breadcrumb segment |
| `breadcrumbs[].prefix` | `string` | Prefix string to pass back to navigate here |
| `folders` | `array` | Virtual folders (CommonPrefixes from S3) |
| `folders[].key` | `string` | Full S3 key of the folder (ends with `/`) |
| `folders[].name` | `string` | Display name (last path segment) |
| `files` | `array` | HDF5 files in this prefix |
| `files[].key` | `string` | Full S3 object key — use this as the file path |
| `files[].name` | `string` | Filename only (last segment of key) |
| `files[].size` | `int` | File size in **bytes** |
| `files[].last_modified` | `string` | ISO 8601 timestamp of last modification |

---

### `GET /health`

Simple liveness check. Returns immediately without connecting to MinIO.

```bash
curl http://localhost:5100/health
```

**Response — `200 OK`**

```json
{
  "status": "ok",
  "service": "H5API"
}
```

---

## Response Schemas

### Breadcrumb Object

```
{ name: string, prefix: string }
```

The `prefix` field is ready to be passed directly as the `prefix` query param to `/api/browse`.

### Folder Object

```
{ key: string, name: string, type: "folder" }
```

### File Object

```
{ key: string, name: string, type: "file", size: number, last_modified: string }
```

---

## How It Works

### MinIO Connection (lazy init)

The boto3 S3 client is created **on first request** (lazy singleton). This avoids startup failures when the MinIO server is temporarily unavailable — the error surfaces on the first actual API call instead.

### Virtual Folder Navigation

MinIO/S3 has no real folders — they are simulated by object key prefixes containing `/`. H5API uses `list_objects_v2` with `Delimiter='/'` which returns:

- **`CommonPrefixes`** → virtual sub-folders at the next `/` level
- **`Contents`** → actual object files at this level

This gives a true single-level directory listing without fetching every object in the bucket.

### Breadcrumb Generation

Given a prefix like `experiments/run1/trial3`, the `make_breadcrumbs()` helper returns:

```
Root → experiments → run1 → trial3
```

Each step includes the cumulative prefix so the UI can navigate directly to any ancestor.

---

## File Filtering

Only files with the following extensions are shown in the browser:

| Extension | Description |
|---|---|
| `.h5` | Standard HDF5 file |
| `.hdf5` | HDF5 file (verbose extension) |
| `.hdf` | Legacy HDF format |

All other object types (`.txt`, `.json`, `.csv`, etc.) are silently ignored. Folders (virtual prefixes) are always shown regardless of their name.
