# js/utils

Shared utility helpers.

## Active Files

- `format.js`: `escapeHtml`, `formatBytes`.
- `debounce.js`: debounce helper for UI interactions.
- `lru.js`: simple LRU cache class.
- `templateLoader.js`: loads and caches HTML templates from `old_web/pages/` and applies placeholders.

## Placeholder Files

- `cache.js` (empty)
- `dom.js` (empty)
- `formatters.js` (empty)

## Imported By

- `format.js`: used by views and components for escaping and formatting.
- `lru.js`: used by `old_web/js/api/hdf5Service.js` and `old_web/js/components/viewerPanel/shared.js`.
- `templateLoader.js`: used by home and viewer views.
