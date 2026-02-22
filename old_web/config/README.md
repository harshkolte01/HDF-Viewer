# config

Runtime config scripts that execute before ES modules.

## Files

- `runtime-config.js`

## What It Does

- Ensures `window.__CONFIG__` exists.
- Allows deployment-time injection of values (mainly `API_BASE_URL`) without editing module code.

## Consumption Flow

1. `old_web/index.html` loads `config/runtime-config.js`.
2. `old_web/js/config.js` reads `window.__CONFIG__.API_BASE_URL`.
3. API modules consume `API_BASE_URL` + `API_ENDPOINTS` from `old_web/js/config.js`.

## Compare Mode Note

- No compare-specific config keys are required.
- Line compare uses the same existing backend endpoints and base URL.
