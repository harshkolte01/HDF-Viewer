# Agent Context (2026-01-27)

Actions
- Added dataset info cache to avoid repeated S3 reads on /preview cache hits.
- Reused cached dataset info in preview route before computing preview cache key.
