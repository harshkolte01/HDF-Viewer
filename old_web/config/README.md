# config

Runtime configuration scripts that execute before ES modules.

## Files

- `runtime-config.js`

## What It Does

- Ensures `window.__CONFIG__` exists.
- Allows deployment-time injection of values (mainly `API_BASE_URL`) without editing module code.

## Consumption Flow

1. `old_web/index.html` loads `config/runtime-config.js`.
2. `old_web/js/config.js` reads `window.__CONFIG__.API_BASE_URL`.
3. API modules use `API_BASE_URL` and `API_ENDPOINTS` from `old_web/js/config.js`.

## Notes

- If nothing is injected, `old_web/js/config.js` falls back to default backend URL.
