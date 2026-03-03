# Viewer_HTML Full-Proof Implementation Plan (HTML-ID Shell + Full Parity)

## Summary
Implement `viewer_html` as a full production viewer using a static, ID-driven `index.html` shell and plain JavaScript files (no ES modules), while preserving full old_web viewer behavior: tree navigation, inspect/display switching, matrix/line/heatmap full runtimes, compare mode, export, fullscreen, caching, and responsive behavior.

## Success Criteria
1. `viewer_html/index.html` contains the permanent layout shell with unique IDs for sidebar, topbar, secondary bar, display pane, and inspect pane.
2. All viewer features available in old_web viewer route are available in `viewer_html`.
3. No `import`/`export` and no `type="module"` anywhere in `viewer_html`.
4. API contract remains unchanged and all data requests use `fetch` with abort support.
5. Implementation is stable on repeated interactions, fast path switching, and fullscreen transitions.

## Public Interfaces / Contracts

## 1. URL Contract
1. Required query param: `file=<url-encoded-object-key>`.
2. Optional query param: `bucket=<bucket-name>`.
3. Missing `file` behavior: render shell, show blocking guidance in status area, skip data calls.

## 2. Runtime Config Contract
1. Load `viewer_html/config/runtime-config.js` before app scripts.
2. Read `window.__CONFIG__.API_BASE_URL` with fallback default.
3. Use normalized base URL (strip trailing slashes).

## 3. DOM ID Contract in `viewer_html/index.html`
1. `viewer-app`
2. `viewer-sidebar`
3. `sidebar-header`
4. `tree-panel`
5. `tree-list`
6. `tree-status`
7. `viewer-main`
8. `viewer-topbar`
9. `breadcrumb-file`
10. `breadcrumb-path`
11. `viewer-subbar`
12. `subbar-tabs`
13. `subbar-actions`
14. `viewer-panel`
15. `display-pane`
16. `inspect-pane`
17. `display-status`
18. `inspect-status`
19. `global-status`
20. `sidebar-backdrop`
21. `sidebar-toggle-btn`
22. `sidebar-close-btn`
23. `viewer-back-btn`
24. `viewer-fullscreen-btn`

## 4. JS Global Contract
1. Global root: `window.HDFViewer`.
2. Required namespaces: `core`, `utils`, `api`, `state`, `components`, `views`, `app`.
3. Runtime export bridge contract stays supported via shell node property `__exportApi`.

## 5. Script Load Order Contract
1. `config/runtime-config.js`
2. `js/core/namespace.js`
3. `js/core/config.js`
4. `js/utils/format.js`
5. `js/utils/lru.js`
6. `js/utils/export.js`
7. `js/api/client.js`
8. `js/api/contracts.js`
9. `js/api/hdf5Service.js`
10. `js/state/store.js`
11. `js/state/reducers/utils.js`
12. `js/state/reducers/filesActions.js`
13. `js/state/reducers/treeActions.js`
14. `js/state/reducers/viewActions.js`
15. `js/state/reducers/displayConfigActions.js`
16. `js/state/reducers/dataActions.js`
17. `js/state/reducers/compareActions.js`
18. `js/state/reducers.js`
19. `js/components/viewerPanel/shared.js`
20. `js/components/viewerPanel/render/config.js`
21. `js/components/viewerPanel/render/previews.js`
22. `js/components/viewerPanel/render/dimensionControls.js`
23. `js/components/viewerPanel/render/sections.js`
24. `js/components/viewerPanel/render.js`
25. `js/components/viewerPanel/runtime/common.js`
26. `js/components/viewerPanel/runtime/matrixRuntime.js`
27. `js/components/viewerPanel/runtime/lineRuntime.js`
28. `js/components/viewerPanel/runtime/heatmapRuntime.js`
29. `js/components/viewerPanel/runtime/bindEvents.js`
30. `js/components/viewerPanel/runtime.js`
31. `js/components/viewerPanel.js`
32. `js/components/sidebarTree.js`
33. `js/views/viewerView.js`
34. `js/app-viewer.js`

## Architecture Decisions
1. Keep shell markup static in `index.html` and update only region content from JS.
2. Use event delegation on stable containers instead of rebinding listeners to every button on rerender.
3. Preserve old_web state/action model and API normalization contracts.
4. Preserve old_web runtime behavior for matrix, line, heatmap, compare, export, fullscreen.
5. Keep CSS theme unchanged (existing copied tokens and component styles).

## Implementation Plan

## Phase 1: Build static HTML shell
1. Replace `#app-root`-only body with permanent viewer shell containing all IDs in the DOM ID contract.
2. Keep all existing CSS links.
3. Keep script list and order from Script Load Order Contract.
4. Add minimal non-JS fallback text in `global-status`.

## Phase 2: Core DOM bridge and guards
1. Add a core DOM refs utility inside existing `viewerView` layer or new `core/domRefs` file.
2. Validate all required IDs at boot and fail fast with clear console message listing missing IDs.
3. Add helper methods for class toggles, status messages, and pane visibility.
4. Add script-order guard checks for every file that depends on prior namespace paths.

## Phase 3: Port API and state logic to functional implementation
1. Replace phase scaffold in `api/client.js` with fetch wrapper using `AbortController`.
2. Replace phase scaffold in `api/contracts.js` and `api/hdf5Service.js` with normalized payload handling and caches.
3. Replace phase scaffold in `state/store.js` and all reducer files with old_web-equivalent logic.
4. Keep state schema parity including compare, display config, and full-view flags.
5. Keep stale-while-refresh preview strategy and request dedupe behavior.

## Phase 4: Viewer view orchestration (ID-driven)
1. Implement `views/viewerView.js` as shell orchestrator that targets static IDs.
2. Render topbar content into `breadcrumb-file` and `breadcrumb-path`.
3. Render subbar tabs/actions into `subbar-tabs` and `subbar-actions`.
4. Render tree markup into `tree-list`.
5. Render display/inspect content into `display-pane` and `inspect-pane`.
6. Switch modes by toggling classes and hidden attributes, not by replacing full shell HTML.

## Phase 5: Component implementation
1. Implement `components/sidebarTree.js` with lazy expand, retry, selection, compare-add button behavior.
2. Implement `components/viewerPanel.js` and `viewerPanel/render*.js` with matrix, line, and heatmap section renderers.
3. Keep dimension controls and metadata rendering parity.
4. Keep status surfaces (`display-status`, `inspect-status`, `tree-status`) synchronized to current state.
5. Maintain dataset compatibility checks for compare mode.

## Phase 6: Runtime implementation for full views
1. Implement `matrixRuntime.js` with virtual block loading, request queueing, and scroll-linked rendering.
2. Implement `lineRuntime.js` with pan, zoom, zoom-click, quality/window controls, compare overlay, fullscreen, export hooks.
3. Implement `heatmapRuntime.js` with canvas draw, colormap/grid controls, pan/zoom, plot mode linked line runtime, fullscreen, export hooks.
4. Keep cleanup registries in `runtime/common.js` and call cleanup on pane rerender or mode change.
5. Ensure runtime shells attach `__exportApi` for subbar export actions.

## Phase 7: App boot and deep-link lifecycle
1. Implement `app-viewer.js` boot sequence.
2. Parse `file` and `bucket`.
3. Initialize shell render and register delegated events once.
4. If `file` exists, dispatch `openViewer` and load root children.
5. If `file` missing, show guidance and disable data actions.
6. Keep sidebar responsive behavior (`matchMedia <= 1024px`) and backdrop handling.
7. Keep viewer fullscreen control at whole-page level.

## Phase 8: Hardening and regression safety
1. Add robust error mapping for network, abort, and contract failures.
2. Prevent stale async responses from overwriting latest state.
3. Guard export actions when runtime shell is not active.
4. Add safe handling when selected path moves from dataset to group during inflight requests.
5. Add defensive checks for invalid shape/ndim/dtype metadata.
6. Add UTF-safe and spreadsheet-safe CSV escaping behavior parity.

## Phase 9: Documentation updates
1. Keep existing `viewer_html/PLAN.md` as primary full-parity plan and append this HTML-ID full-implementation variant section.
2. Add new context note:
   - `docs/AGENT_CONTEXT_2026-03-03_VIEWER_HTML_HTML_ID_FULL_IMPLEMENTATION_PLAN.md`
3. Document:
   - Final ID contract
   - Script order
   - Feature parity checklist
   - Known browser support and constraints

## Test Cases and Scenarios

## A. Shell and boot
1. All required IDs exist and boot succeeds.
2. Missing one required ID produces deterministic boot error.
3. Missing `file` shows blocking message and no `/children` request.
4. Valid `file` loads tree root and default inspect state.

## B. Tree and navigation
1. Expand/collapse root and nested groups.
2. Retry failed child loads.
3. Breadcrumb click loads ancestor path.
4. Dataset selection switches to preview/metadata appropriately.

## C. Inspect and display
1. Inspect mode shows metadata summary and raw JSON.
2. Display mode loads preview and tab-specific section.
3. Tab switches preserve expected flags and clear incompatible full-view states.

## D. Matrix runtime
1. Full matrix load works for 2D and ND slices.
2. Scroll triggers block requests and cache reuse.
3. CSV displayed and CSV full export both function.

## E. Line runtime
1. Full line load supports pan, zoom, zoom-click, reset, jump controls.
2. Compare mode supports add/remove/clear and compatibility validation.
3. SVG PNG export and CSV export function.
4. Fullscreen enter/exit stable across rerenders.

## F. Heatmap runtime
1. Full heatmap load supports pan, zoom, colormap, grid toggle.
2. Plot mode linked line panel works and closes cleanly.
3. Canvas PNG export and CSV export function.
4. Fullscreen enter/exit stable across rerenders.

## G. Error and race handling
1. Rapid path changes cancel stale requests.
2. Abort errors do not show as hard failures.
3. 4xx/5xx show friendly status without uncaught exceptions.
4. Invalid API payload produces controlled error status.

## H. Responsive and accessibility baseline
1. Sidebar behavior correct on desktop and mobile breakpoints.
2. Keyboard navigation works for primary controls.
3. Buttons and tabs expose clear labels and disabled states.

## I. Non-module compliance
1. No `import` or `export` in `viewer_html/js/**/*.js`.
2. No `type="module"` in `viewer_html/index.html`.
3. App runs from static server in modern browsers.

## Assumptions and Defaults
1. Scope is full parity with old_web viewer behavior, not a reduced subset.
2. Fetch is the single HTTP mechanism; no XMLHttpRequest usage.
3. Browser target is modern evergreen browsers only.
4. CSS visual language remains unchanged from copied old_web theme files.
5. Existing scaffold files in `viewer_html/js` are replaced in place rather than creating a parallel runtime tree.
