# Dependency Fixes (2026-01-26)

Issue
- Import failure for h5py with error about numpy.dtype size mismatch.

Cause
- Runtime had numpy 2.x, while h5py 3.10.0 wheels are built against numpy 1.x ABI.

Fix
- Pinned numpy to 1.26.4 in backend/requirements.txt to keep ABI compatible with h5py 3.10.0.

Notes
- If you need numpy 2.x later, upgrade h5py to a version that explicitly supports numpy 2.x and rebuild.
