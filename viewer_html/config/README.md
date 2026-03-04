# config

Runtime configuration bootstrap for `viewer_html`.

## What is implemented
- `runtime-config.js` guarantees `window.__CONFIG__` exists before any viewer module reads configuration.

## How it is implemented
- The file executes first in `index.html`.
- Deployments can inject values (for example `API_BASE_URL`) into `window.__CONFIG__` without changing application source files.
- `js/core/config.js` reads this object and resolves normalized API endpoints.
