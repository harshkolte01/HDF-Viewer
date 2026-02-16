# config

Runtime configuration scripts that run before ES modules.

## Files

- `runtime-config.js`

## What Is Implemented

- Defines `window.__CONFIG__` if it does not exist.
- Supports runtime injection of values like `API_BASE_URL` without rebuilding JS bundles.

## Import and Consumption Flow

- Loaded by `old_web/index.html` using a normal `<script>` tag.
- Consumed by `old_web/js/config.js`, which reads `window.__CONFIG__.API_BASE_URL`.
