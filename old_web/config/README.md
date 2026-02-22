# config

Runtime configuration scripts that execute before ES modules.

## Files

- `runtime-config.js`

## Responsibility

- Ensures `window.__CONFIG__` exists.
- Supports deployment-time injection for `API_BASE_URL` without changing source modules.

## Consumption Flow

1. `old_web/index.html` loads `config/runtime-config.js`.
2. `old_web/js/config.js` resolves `API_BASE_URL` from `window.__CONFIG__`.
3. API and export utilities consume that base URL.

## Export Note

- Full CSV export URLs are built in `old_web/js/utils/export.js`.
- No additional export-specific config keys are required.
