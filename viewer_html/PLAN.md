# Viewer_HTML Single-Entry Plain-JS Viewer (Production Plan)

## Summary
Build a viewer-only frontend in `viewer_html/` with one entry page (`index.html`) and no ES modules (`import/export` removed).  
The runtime will keep full old_web viewer parity (sidebar tree, top bar, secondary top bar, inspect/display, matrix/line/heatmap full runtimes, compare, export, fullscreen), use unchanged theme/CSS values, and be self-contained for deployment.

## Locked Decisions
- JavaScript strategy: multi-file plain scripts with a shared global namespace.
- Feature scope: full parity with current old_web viewer behavior.
- Missing `?file=` behavior: block viewer with clear guidance (no auto-open fallback).
- Asset strategy: self-contained `viewer_html` (own copied CSS/assets and plain JS runtime).

## Final Target Structure
```text
viewer_html/
  index.html
  assets/
    ...copied from old_web/assets
  css/
    tokens.css
    app.css
    home.css
    viewer.css
    viewer-panel.css
    components/
      tree.css
      table.css
      charts.css
  js/
    core/
      namespace.js
      config.js
    utils/
      format.js
      lru.js
      export.js
    api/
      client.js
      contracts.js
      hdf5Service.js
    state/
      store.js
      reducers.js
      reducers/
        utils.js
        filesActions.js
        treeActions.js
        viewActions.js
        displayConfigActions.js
        dataActions.js
        compareActions.js
    components/
      sidebarTree.js
      viewerPanel.js
      viewerPanel/
        shared.js
        render.js
        runtime.js
        render/
          config.js
          previews.js
          dimensionControls.js
          sections.js
        runtime/
          common.js
          bindEvents.js
          matrixRuntime.js
          lineRuntime.js
          heatmapRuntime.js
    views/
      viewerView.js
    app-viewer.js
```

## Public Interfaces / Contracts
- URL contract for viewer page:
  - Required: `?file=<url-encoded-object-key>`
  - Optional: `&bucket=<bucket-name>`
- Missing file UX contract:
  - Render full viewer shell with blocking empty-state panel: “Missing `file` query parameter”.
  - No tree/data requests until parameter is present.
- Global runtime contract:
  - `window.HDFViewer` namespace contains all modules and boot entry.
  - No `type="module"` scripts anywhere in `viewer_html/index.html`.
- Backend API contract: unchanged
  - `GET /files`
  - `POST /files/refresh`
  - `GET /files/<key>/children`
  - `GET /files/<key>/meta`
  - `GET /files/<key>/preview`
  - `GET /files/<key>/data`
  - `GET /files/<key>/export/csv`

## Implementation Plan

## Phase 1: Bootstrap viewer_html shell
1. Create `viewer_html/index.html` as the single entry page.
2. Copy CSS and assets from `old_web` into `viewer_html` unchanged.
3. Keep stylesheet includes aligned with current viewer runtime (`tokens.css`, `app.css`, `viewer.css`, `viewer-panel.css`, component CSS; keep `home.css` copied for parity/safety).
4. Add script tags with `defer` in strict dependency order (defined in Phase 3).

## Phase 2: Non-module architecture scaffold
1. Add `js/core/namespace.js`:
   - Create `window.HDFViewer` root object.
   - Pre-create domains: `core`, `utils`, `api`, `state`, `components`, `views`, `app`.
2. Add `js/core/config.js`:
   - Port `API_BASE_URL`, endpoint builders, `encodeObjectKeyForPath`.
   - Resolve runtime config from `window.__CONFIG__` with safe default.
3. Enforce coding rule for every JS file:
   - Remove all `import`/`export`.
   - Wrap file in IIFE `(function(ns){ ... })(window.HDFViewer);`
   - Publish symbols into namespace object explicitly.

## Phase 3: Port modules by layer (exact order)
1. Utilities:
   - `format.js`, `lru.js`, `export.js`
2. API:
   - `client.js`, `contracts.js`, `hdf5Service.js`
3. State:
   - `store.js`
   - `reducers/utils.js`
   - `reducers/filesActions.js`
   - `reducers/treeActions.js`
   - `reducers/viewActions.js`
   - `reducers/displayConfigActions.js`
   - `reducers/dataActions.js`
   - `reducers/compareActions.js`
   - `reducers.js`
4. Viewer panel base:
   - `components/viewerPanel/shared.js`
   - `components/viewerPanel/render/config.js`
   - `components/viewerPanel/render/previews.js`
   - `components/viewerPanel/render/dimensionControls.js`
   - `components/viewerPanel/render/sections.js`
   - `components/viewerPanel/render.js`
   - `components/viewerPanel/runtime/common.js`
   - `components/viewerPanel/runtime/matrixRuntime.js`
   - `components/viewerPanel/runtime/lineRuntime.js`
   - `components/viewerPanel/runtime/heatmapRuntime.js`
   - `components/viewerPanel/runtime/bindEvents.js`
   - `components/viewerPanel/runtime.js`
   - `components/viewerPanel.js`
5. Tree + view:
   - `components/sidebarTree.js`
   - `views/viewerView.js`
6. Boot:
   - `app-viewer.js`

## Phase 4: Viewer-only boot logic
1. Replace old `app.js` route model with viewer-only boot:
   - Always render viewer shell into `#app-root`.
   - Parse `file` and `bucket` query params.
2. If `file` is present:
   - Dispatch `openViewer({ key:file, etag:null, bucket })`.
   - Start at inspect mode and lazy-load tree root.
3. If `file` is missing:
   - Render blocking guidance state.
   - Show exact deep-link format example in UI.
4. Keep existing behavior for:
   - Sidebar collapse/responsive behavior.
   - Display/inspect switching.
   - Matrix/line/heatmap full runtimes.
   - Compare flow.
   - Export CSV/PNG.
   - Fullscreen interactions.

## Phase 5: Production hardening
1. Add lightweight runtime assertions:
   - Validate required dataset attributes on runtime shells.
   - Fail gracefully with status messages, not thrown uncaught errors.
2. Add namespace collision guard:
   - Abort boot with console error if `window.HDFViewer` already initialized unexpectedly.
3. Add script-order guard:
   - Each module checks dependency presence and logs explicit missing module path.

## Phase 6: Docs update
1. Add planning doc in root docs:
   - `docs/AGENT_CONTEXT_2026-03-03_VIEWER_HTML_PLAIN_JS_PRODUCTION_PLAN.md`
2. Document:
   - Why non-module conversion is needed.
   - Final folder structure.
   - Script load order.
   - URL/deep-link contract.
   - Regression checklist.
3. Add pointer in existing setup guide:
   - Link from `OLD_WEB_VIEWER_ONLY_SETUP_GUIDE.md` to the new viewer_html plan note.

## Test Cases and Scenarios

## Functional parity tests
1. Boot with valid `?file=` and optional `&bucket=` opens viewer and loads tree root.
2. Missing `?file=` shows blocking guidance state and performs no viewer data calls.
3. Tree expand/collapse/select works with lazy child loading and retry behavior.
4. Inspect mode loads metadata and displays summary + raw JSON.
5. Display mode loads preview for dataset selection.
6. Matrix full view: virtual scrolling, status updates, CSV displayed/full export.
7. Line full view: pan/zoom/zoom-click/window controls/fullscreen, CSV+PNG export.
8. Line compare: enable/disable, add/remove/clear, compatibility enforcement, legend/status.
9. Heatmap full view: zoom/pan/plot mode/linked line shell/fullscreen, CSV+PNG export.
10. Back-to-files control remains present but is safely no-op or guidance-return in viewer-only context.

## Error and resilience tests
1. Backend 4xx/5xx responses show user-facing status text without app crash.
2. Aborted requests do not surface false error banners.
3. Invalid `file` key displays recoverable error state in tree/panel.
4. Export without loaded full runtime shows expected “Load full … before exporting” message.

## Responsive tests
1. `<=1024px`: sidebar defaults collapsed, backdrop/toggle works.
2. Desktop: sidebar open/collapse class behavior matches existing viewer CSS.
3. Fullscreen entry/exit state remains consistent after rerenders.

## Non-module compliance tests
1. `viewer_html/index.html` has no `type="module"` scripts.
2. `viewer_html/js/**/*.js` contains no `import` or `export` statements.
3. Scripts execute successfully when loaded as plain deferred scripts in order.

## Assumptions and Defaults
- “Only one index.html” means one HTML entrypoint, not one-file-only app artifact.
- Full old_web viewer behavior is required in first release (not a staged subset).
- Theme and CSS remain the same values and styles as existing old_web assets.
- Backend API contract remains unchanged.
- Doc artifact is created in root `docs/` as the agent context record for this planning work.
