# Backend Review (2026-01-26)

Scope: backend folder (app, routes, readers, storage, utils, scripts, docs).

Findings
- /benchmark endpoint is documented but no route is registered in the app.
- Metadata endpoint returns 500 for missing object keys or invalid paths instead of a 404/400.
- Metadata response schema is inconsistent (type becomes a dict, attributes shape differs from README).
- CORS config ignores CORS_ORIGINS and allows all origins unconditionally.
- Missing-path handling in children lookup returns an empty list with success.
- Cache is unbounded in-memory; high cardinality keys can grow memory until TTL expiry.

Testing gaps
- No automated tests were found for routes, storage, or reader behavior.
