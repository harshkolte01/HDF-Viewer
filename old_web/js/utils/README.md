# js/utils

Shared utility modules.

## Active Files

- `format.js`: formatting and `escapeHtml` helpers.
- `debounce.js`: generic debounce utility.
- `lru.js`: LRU cache implementation.
- `templateLoader.js`: runtime HTML template loader with in-memory cache.
- `export.js`: shared CSV/PNG export utilities.

## `export.js` Responsibilities

- CSV helpers:
- filename generation with timestamp
- CSV cell escaping and row creation
- BOM-enabled CSV blob creation
- Blob/url download triggers

- Full export URL helper:
- `buildCsvExportUrl(fileKey, params)` for backend `/files/<key>/export/csv`

- PNG helpers:
- line SVG to PNG rasterization (`svgElementToPngBlob`)
- heatmap canvas to PNG conversion (`canvasElementToPngBlob`)

## Placeholder Files (Inactive)

- `cache.js`
- `dom.js`
- `formatters.js`

These files are retained for compatibility and are not used by active runtime.
