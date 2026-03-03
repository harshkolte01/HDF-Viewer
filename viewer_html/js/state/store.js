(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/store.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/store.");
    return;
  }
  var moduleState = ensurePath(ns, "state.store");
const state = {
  route: "home",
  viewerBlocked: true,
  files: [],
  loading: false,
  error: null,
  refreshing: false,
  searchQuery: "",
  selectedFile: null,
  selectedFileEtag: null,
  selectedFileBucket: null,
  selectedNodeType: "group",
  selectedNodeName: "/",
  selectedPath: "/",
  expandedPaths: new Set(["/"]),
  childrenCache: new Map(),
  treeLoadingPaths: new Set(),
  treeErrors: new Map(),
  viewMode: "inspect",
  metadata: null,
  metadataLoading: false,
  metadataError: null,
  preview: null,
  previewLoading: false,
  previewError: null,
  previewRequestKey: null,
  previewRequestInFlight: false,
  displayTab: "line",
  notation: "auto",
  lineGrid: true,
  lineAspect: "line",
  lineCompareEnabled: false,
  lineCompareItems: [],
  lineCompareStatus: null,
  heatmapGrid: true,
  heatmapColormap: "viridis",
  matrixFullEnabled: false,
  lineFullEnabled: false,
  heatmapFullEnabled: false,
  matrixBlockSize: {
    rows: 160,
    cols: 40,
  },
  displayConfig: {
    displayDims: null,
    fixedIndices: {},
    stagedDisplayDims: null,
    stagedFixedIndices: {},
  },
  cacheResponses: {
    files: [],
    children: {},
    meta: {},
    preview: {},
    data: {},
  },
  rendererPlan: {
    line: "svg",
    heatmap: "canvas",
    matrix: "block-rendering",
  },
  sidebarOpen: true,
};

const listeners = new Set();
function getState() {
  return state;
}
function setState(updater) {
  const patch = typeof updater === "function" ? updater(state) : updater;
  if (!patch || typeof patch !== "object") {
    return;
  }

  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
  if (typeof state !== "undefined") {
    moduleState.state = state;
    global.state = state;
  }
  if (typeof getState !== "undefined") {
    moduleState.getState = getState;
    global.getState = getState;
  }
  if (typeof setState !== "undefined") {
    moduleState.setState = setState;
    global.setState = setState;
  }
  if (typeof subscribe !== "undefined") {
    moduleState.subscribe = subscribe;
    global.subscribe = subscribe;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/store");
  }
})(typeof window !== "undefined" ? window : globalThis);
