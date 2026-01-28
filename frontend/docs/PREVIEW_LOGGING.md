# Frontend Preview Logging

Date: 2026-01-27
Status: Complete
Type: Frontend Debug

## Overview

Added lightweight console logging for the preview flow to verify requests, cache hits, and dimension changes during development.

## What Logs

- Preview request payload (fileKey, selectedPath, params)
- Preview response summary (cached flag, ndim, shape, display_dims, fixed_indices)
- Preview errors
- Display dimension changes
- Fixed index changes

## Where

- `frontend/src/pages/ViewerPage.jsx`

## Notes

- Logs are gated by `import.meta.env.DEV`.
- Production builds remain clean.
