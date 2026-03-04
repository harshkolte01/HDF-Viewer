# js/utils

Shared helper utilities used across API, state, render, and runtime modules.

## What is implemented
- `format.js`: HTML escaping and byte size formatting.
- `lru.js`: bounded map with least-recently-used eviction.
- `export.js`: CSV/PNG export helpers, filename generation, CSV safety escaping, and download triggers.

## How it is implemented
- Utilities are published to the global namespace and reused across layers.
- Export helpers support both blob downloads (displayed data) and URL-triggered downloads (full exports).
- CSV escaping includes spreadsheet-formula hardening for safer exported files.
