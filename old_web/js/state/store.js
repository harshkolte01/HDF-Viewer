export const state = {
  route: "home",
  files: [],
  loading: false,
  error: null,
  refreshing: false,
  searchQuery: "",
  selectedFile: null,
  selectedFileEtag: null,
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
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(updater) {
  const patch = typeof updater === "function" ? updater(state) : updater;
  if (!patch || typeof patch !== "object") {
    return;
  }

  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
