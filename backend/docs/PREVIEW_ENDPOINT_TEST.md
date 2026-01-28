# Preview Endpoint Test (test1.h5)

This guide exercises the new preview endpoint against `test1.h5`.

## Prereqs
- Backend running locally (default: http://localhost:5000)
- `test1.h5` exists in the configured S3/MinIO bucket
- Known dataset path inside `test1.h5`

Known dataset paths in `test1.h5` (from the current file structure):
- `/Unnamed/Connections`
- `/Unnamed/DataOne`
- `/Unnamed/DataTwo`
- `/Unnamed/XYZ`

If you need to confirm shapes/dimensions, check metadata first:

```bash
curl "http://localhost:5000/files/test1.h5/meta?path=/Unnamed/Connections"
```

If you do not know a dataset path, list children at root:

```bash
curl "http://localhost:5000/files/test1.h5/children?path=/"
```

Pick a dataset `path` from the response, then use it below.

## 1D dataset preview

```bash
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/Connections"
```

Expected fields (top-level):
- `success`, `key`, `path`, `dtype`, `shape`, `ndim`, `preview_type`
- `stats` with `min/max/mean/std` (sampled)
- `table` with first values
- `plot` with line points
- `cached`

## 2D dataset preview

```bash
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/DataOne"
```

Expected fields:
- `plot.type = heatmap`
- `plot.shape` up to 512x512
- `table.shape` up to 200x200
- `profile` row preview with line points

## ND dataset preview (3D+)

```bash
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/DataTwo"
```

Defaults:
- `display_dims`: last two dims
- `fixed_indices`: middle index for other dims

Override plane and indices:

```bash
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/XYZ&display_dims=1,2&fixed_indices=0=4,3=10&max_size=512"
```

## Cache behavior

Run the same request twice and confirm `cached` toggles to `true` on the second call:

```bash
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/DataOne"
curl "http://localhost:5000/files/test1.h5/preview?path=/Unnamed/DataOne"
```

## Failure cases to verify
- Missing `path` should return HTTP 400.
- Non-dataset paths should return HTTP 400 with a type error.
- Invalid dataset path should return HTTP 404.
