# js/utils

Shared utility modules.

## Active Files

- `format.js`
- `escapeHtml`, `formatBytes`.
- `debounce.js`
- Generic debounce helper.
- `lru.js`
- Simple LRU cache used by API/runtime caching.
- `templateLoader.js`
- Loads `old_web/pages/*.html`, caches templates, applies placeholders.

## Placeholder Files

- `cache.js` (empty)
- `dom.js` (empty)
- `formatters.js` (empty)

## Import Notes

- `templateLoader.js` is used by `homeView.js` and `viewerView.js`.
- `lru.js` is used by `js/api/hdf5Service.js` and runtime caches.
- Compare mode relies on shared helpers (`escapeHtml`, caching) but adds no utility-module specific APIs.
