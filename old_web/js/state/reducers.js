import {
  getFiles,
  refreshFiles,
  getFileChildren,
  getFileMeta,
  getFilePreview,
} from "../api/hdf5Service.js";
import { getState, setState } from "./store.js";

function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }

  const normalized = `/${String(path).replace(/^\/+/, "").replace(/\/+/g, "/")}`;
  return normalized.endsWith("/") && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized;
}

function getAncestorPaths(path) {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return ["/"];
  }

  const parts = normalized.split("/").filter(Boolean);
  const ancestors = ["/"];
  let current = "";

  parts.forEach((part) => {
    current += `/${part}`;
    ancestors.push(current);
  });

  return ancestors;
}

function getNodeName(path, fallbackName = "") {
  if (fallbackName) {
    return fallbackName;
  }

  const normalized = normalizePath(path);
  if (normalized === "/") {
    return "/";
  }

  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "/";
}

function toSafeInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function getDisplayConfigDefaults() {
  return {
    displayDims: null,
    fixedIndices: {},
    stagedDisplayDims: null,
    stagedFixedIndices: {},
  };
}

function normalizeShape(shape) {
  if (!Array.isArray(shape)) {
    return [];
  }

  return shape.map((size) => Math.max(0, toSafeInteger(size, 0)));
}

function getDefaultDisplayDims(shape) {
  return shape.length >= 2 ? [0, 1] : null;
}

function normalizeDisplayDimsForShape(displayDims, shape) {
  if (shape.length < 2) {
    return null;
  }

  if (!Array.isArray(displayDims) || displayDims.length !== 2) {
    return null;
  }

  const dims = displayDims.map((dim) => toSafeInteger(dim, null));
  if (dims.some((dim) => dim === null || dim < 0 || dim >= shape.length)) {
    return null;
  }

  if (dims[0] === dims[1]) {
    const fallback = Array.from({ length: shape.length }, (_, idx) => idx).find(
      (dim) => dim !== dims[0]
    );

    if (fallback === undefined) {
      return null;
    }

    dims[1] = fallback;
  }

  return dims;
}

function normalizeFixedIndicesForShape(fixedIndices, shape, displayDims = []) {
  const hiddenDims = new Set(Array.isArray(displayDims) ? displayDims : []);
  const normalized = {};

  if (!fixedIndices || typeof fixedIndices !== "object") {
    return normalized;
  }

  Object.entries(fixedIndices).forEach(([dimKey, indexValue]) => {
    const dim = toSafeInteger(dimKey, null);
    const index = toSafeInteger(indexValue, null);

    if (
      dim === null ||
      index === null ||
      dim < 0 ||
      dim >= shape.length ||
      hiddenDims.has(dim)
    ) {
      return;
    }

    const max = Math.max(0, shape[dim] - 1);
    normalized[dim] = Math.max(0, Math.min(max, index));
  });

  return normalized;
}

function buildNextFixedIndices(currentIndices, displayDims, shape) {
  const normalizedDims = Array.isArray(displayDims) ? displayDims : [];
  const next = normalizeFixedIndicesForShape(currentIndices, shape, normalizedDims);
  const hidden = new Set(normalizedDims);

  shape.forEach((size, dim) => {
    if (hidden.has(dim)) {
      delete next[dim];
      return;
    }

    const max = Math.max(0, size - 1);
    const fallback = size > 0 ? Math.floor(size / 2) : 0;

    if (!Number.isFinite(next[dim])) {
      next[dim] = fallback;
      return;
    }

    next[dim] = Math.max(0, Math.min(max, toSafeInteger(next[dim], fallback)));
  });

  return next;
}

function buildDisplayDimsParam(displayDims) {
  if (!Array.isArray(displayDims) || displayDims.length !== 2) {
    return undefined;
  }

  return `${displayDims[0]},${displayDims[1]}`;
}

function buildFixedIndicesParam(fixedIndices) {
  if (!fixedIndices || typeof fixedIndices !== "object") {
    return undefined;
  }

  const entries = Object.entries(fixedIndices)
    .map(([dim, index]) => [toSafeInteger(dim, null), toSafeInteger(index, null)])
    .filter(([dim, index]) => dim !== null && index !== null)
    .sort(([a], [b]) => a - b);

  if (!entries.length) {
    return undefined;
  }

  return entries.map(([dim, index]) => `${dim}=${index}`).join(",");
}

function areDisplayDimsEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

function areFixedIndicesEqual(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  const leftKeys = Object.keys(left).sort((x, y) => Number(x) - Number(y));
  const rightKeys = Object.keys(right).sort((x, y) => Number(x) - Number(y));

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => {
    const otherKey = rightKeys[index];
    return key === otherKey && Number(left[key]) === Number(right[otherKey]);
  });
}

function resolveDisplayDimsFromConfig(config, shape) {
  return (
    normalizeDisplayDimsForShape(config?.stagedDisplayDims, shape) ||
    normalizeDisplayDimsForShape(config?.displayDims, shape) ||
    getDefaultDisplayDims(shape)
  );
}

function getNextAvailableDim(totalDims, disallowedDims = [], preferred = 0) {
  if (totalDims <= 0) {
    return null;
  }

  const blocked = new Set(disallowedDims);
  const normalizedPreferred = Math.max(0, Math.min(totalDims - 1, toSafeInteger(preferred, 0)));

  if (!blocked.has(normalizedPreferred)) {
    return normalizedPreferred;
  }

  for (let offset = 1; offset < totalDims; offset += 1) {
    const plus = normalizedPreferred + offset;
    if (plus < totalDims && !blocked.has(plus)) {
      return plus;
    }

    const minus = normalizedPreferred - offset;
    if (minus >= 0 && !blocked.has(minus)) {
      return minus;
    }
  }

  return null;
}

export const actions = {
  async loadFiles() {
    setState({ loading: true, error: null });

    try {
      const data = await getFiles();
      const files = Array.isArray(data.files) ? data.files : [];

      setState((prev) => ({
        files,
        loading: false,
        cacheResponses: {
          ...prev.cacheResponses,
          files,
        },
      }));
    } catch (error) {
      setState({
        loading: false,
        error: error.message || "Failed to load files",
      });
    }
  },

  async refreshFileList() {
    setState({ refreshing: true, error: null });

    try {
      await refreshFiles();
      await actions.loadFiles();
    } catch (error) {
      setState({
        error: error.message || "Failed to refresh files",
      });
    } finally {
      setState({ refreshing: false });
    }
  },

  openViewer(fileSelection) {
    const selection =
      typeof fileSelection === "string"
        ? { key: fileSelection, etag: null }
        : fileSelection || {};

    setState({
      route: "viewer",
      selectedFile: selection.key || null,
      selectedFileEtag: selection.etag || null,
      selectedNodeType: "group",
      selectedNodeName: "/",
      selectedPath: "/",
      expandedPaths: new Set(["/"]),
      childrenCache: new Map(),
      treeLoadingPaths: new Set(),
      treeErrors: new Map(),
      metadata: null,
      metadataLoading: false,
      metadataError: null,
      preview: null,
      previewLoading: false,
      previewError: null,
      viewMode: "inspect",
      displayTab: "table",
      notation: "auto",
      lineGrid: true,
      lineAspect: "line",
      heatmapGrid: true,
      heatmapColormap: "viridis",
      matrixFullEnabled: false,
      displayConfig: getDisplayConfigDefaults(),
    });

    void actions.loadTreeChildren("/");

    const current = getState();
    if (current.route === "viewer" && current.viewMode === "inspect") {
      void actions.loadMetadata("/");
    }
  },

  goHome() {
    setState({
      route: "home",
      selectedPath: "/",
    });
  },

  setSearchQuery(searchQuery) {
    setState({ searchQuery });
  },

  setSelectedPath(path) {
    return actions.onBreadcrumbSelect(path);
  },

  onBreadcrumbSelect(path) {
    const normalizedPath = normalizePath(path);
    const requiredAncestors = getAncestorPaths(normalizedPath);

    setState((prev) => {
      const expanded = new Set(prev.expandedPaths || ["/"]);
      requiredAncestors.forEach((entry) => expanded.add(entry));

      return {
        selectedPath: normalizedPath,
        selectedNodeType: "group",
        selectedNodeName: getNodeName(normalizedPath),
        expandedPaths: expanded,
        matrixFullEnabled: false,
        displayConfig: getDisplayConfigDefaults(),
        metadata: null,
        metadataLoading: false,
        metadataError: null,
        preview: null,
        previewLoading: false,
        previewError: null,
      };
    });

    void actions.loadTreeChildren(normalizedPath);

    const current = getState();
    if (current.route === "viewer" && current.viewMode === "inspect") {
      void actions.loadMetadata(normalizedPath);
    }
  },

  async loadTreeChildren(path, options = {}) {
    const normalizedPath = normalizePath(path);
    const { force = false } = options;
    const snapshot = getState();

    if (!snapshot.selectedFile) {
      return [];
    }

    if (!force && snapshot.childrenCache instanceof Map && snapshot.childrenCache.has(normalizedPath)) {
      return snapshot.childrenCache.get(normalizedPath) || [];
    }

    setState((prev) => {
      const treeLoadingPaths = new Set(prev.treeLoadingPaths || []);
      treeLoadingPaths.add(normalizedPath);

      const treeErrors = new Map(prev.treeErrors || []);
      treeErrors.delete(normalizedPath);

      return {
        treeLoadingPaths,
        treeErrors,
      };
    });

    try {
      const response = await getFileChildren(snapshot.selectedFile, normalizedPath, { force });
      const children = Array.isArray(response.children) ? response.children : [];

      setState((prev) => {
        const childrenCache = new Map(prev.childrenCache || []);
        childrenCache.set(normalizedPath, children);

        const treeLoadingPaths = new Set(prev.treeLoadingPaths || []);
        treeLoadingPaths.delete(normalizedPath);

        return {
          childrenCache,
          treeLoadingPaths,
        };
      });

      return children;
    } catch (error) {
      setState((prev) => {
        const treeLoadingPaths = new Set(prev.treeLoadingPaths || []);
        treeLoadingPaths.delete(normalizedPath);

        const treeErrors = new Map(prev.treeErrors || []);
        treeErrors.set(normalizedPath, error.message || "Failed to load tree node");

        return {
          treeLoadingPaths,
          treeErrors,
        };
      });

      throw error;
    }
  },

  toggleTreePath(path) {
    const normalizedPath = normalizePath(path);
    let shouldExpand = false;

    setState((prev) => {
      const expandedPaths = new Set(prev.expandedPaths || ["/"]);

      if (normalizedPath === "/") {
        expandedPaths.add("/");
        shouldExpand = true;
      } else if (expandedPaths.has(normalizedPath)) {
        expandedPaths.delete(normalizedPath);
      } else {
        expandedPaths.add(normalizedPath);
        shouldExpand = true;
      }

      return { expandedPaths };
    });

    if (shouldExpand) {
      void actions.loadTreeChildren(normalizedPath);
    }
  },

  selectTreeNode(node) {
    const normalizedPath = normalizePath(node.path || "/");
    const nodeType = node.type === "dataset" ? "dataset" : "group";
    const nodeName = getNodeName(normalizedPath, node.name || "");
    const requiredAncestors = getAncestorPaths(normalizedPath);

    setState((prev) => {
      const expandedPaths = new Set(prev.expandedPaths || ["/"]);
      requiredAncestors.forEach((entry) => expandedPaths.add(entry));

      return {
        selectedPath: normalizedPath,
        selectedNodeType: nodeType,
        selectedNodeName: nodeName,
        expandedPaths,
        matrixFullEnabled: false,
        ...(nodeType === "dataset" ? { displayConfig: getDisplayConfigDefaults() } : {}),
        ...(nodeType === "group"
          ? {
              displayConfig: getDisplayConfigDefaults(),
              metadata: null,
              metadataLoading: false,
              metadataError: null,
              preview: null,
              previewLoading: false,
              previewError: null,
            }
          : {}),
      };
    });

    const current = getState();
    if (nodeType === "group") {
      void actions.loadTreeChildren(normalizedPath);
      if (current.viewMode === "inspect") {
        void actions.loadMetadata(normalizedPath);
      }
      return;
    }

    if (current.viewMode === "display") {
      void actions.loadPreview(normalizedPath);
    } else {
      void actions.loadMetadata(normalizedPath);
    }
  },

  setViewMode(viewMode) {
    const mode = viewMode === "display" ? "display" : "inspect";
    setState({
      viewMode: mode,
      ...(mode === "inspect" ? { matrixFullEnabled: false } : {}),
    });

    const current = getState();
    if (current.route !== "viewer") {
      return;
    }

    if (mode === "display") {
      if (current.selectedNodeType === "dataset") {
        void actions.loadPreview(current.selectedPath);
      }
    } else {
      void actions.loadMetadata(current.selectedPath);
    }
  },

  setDisplayTab(tab) {
    const nextTab = ["table", "line", "heatmap"].includes(tab) ? tab : "table";
    setState({
      displayTab: nextTab,
      ...(nextTab !== "table" ? { matrixFullEnabled: false } : {}),
    });
  },

  enableMatrixFullView() {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    const displayDims =
      normalizeDisplayDimsForShape(snapshot.displayConfig?.displayDims, shape) ||
      normalizeDisplayDimsForShape(snapshot.preview?.display_dims, shape) ||
      getDefaultDisplayDims(shape);

    const canEnable =
      snapshot.route === "viewer" &&
      snapshot.viewMode === "display" &&
      snapshot.selectedNodeType === "dataset" &&
      shape.length >= 2 &&
      Array.isArray(displayDims) &&
      displayDims.length === 2;

    if (!canEnable) {
      return;
    }

    setState({ matrixFullEnabled: true });
  },

  setNotation(notation) {
    const nextNotation = ["auto", "scientific", "exact"].includes(notation)
      ? notation
      : "auto";
    setState({ notation: nextNotation });
  },

  toggleLineGrid() {
    setState((prev) => ({ lineGrid: !prev.lineGrid }));
  },

  setLineAspect(value) {
    const nextValue = ["line", "point", "both"].includes(value) ? value : "line";
    setState({ lineAspect: nextValue });
  },

  toggleHeatmapGrid() {
    setState((prev) => ({ heatmapGrid: !prev.heatmapGrid }));
  },

  setHeatmapColormap(value) {
    const options = ["viridis", "plasma", "inferno", "magma", "cool", "hot"];
    const nextValue = options.includes(value) ? value : "viridis";
    setState({ heatmapColormap: nextValue });
  },

  setDisplayConfig(displayConfigPatch) {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    const current = snapshot.displayConfig || getDisplayConfigDefaults();
    const nextRaw = { ...current, ...(displayConfigPatch || {}) };
    const nextDims = normalizeDisplayDimsForShape(nextRaw.displayDims, shape);
    const nextStagedDims = normalizeDisplayDimsForShape(nextRaw.stagedDisplayDims, shape);

    setState((prev) => ({
      displayConfig: {
        ...(prev.displayConfig || getDisplayConfigDefaults()),
        ...nextRaw,
        displayDims: nextDims,
        fixedIndices: normalizeFixedIndicesForShape(nextRaw.fixedIndices, shape, nextDims || []),
        stagedDisplayDims: nextStagedDims,
        stagedFixedIndices: normalizeFixedIndicesForShape(
          nextRaw.stagedFixedIndices,
          shape,
          nextStagedDims || []
        ),
      },
    }));
  },

  stageDisplayDims(nextDims, options = {}) {
    const { applyImmediately = false } = options;
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    const normalizedDims = normalizeDisplayDimsForShape(nextDims, shape);

    if (!normalizedDims) {
      return;
    }

    const currentConfig = snapshot.displayConfig || getDisplayConfigDefaults();
    const sourceFixedIndices =
      Object.keys(currentConfig.stagedFixedIndices || {}).length > 0
        ? currentConfig.stagedFixedIndices
        : currentConfig.fixedIndices;
    const nextFixedIndices = buildNextFixedIndices(sourceFixedIndices, normalizedDims, shape);

    setState((prev) => ({
      displayConfig: {
        ...(prev.displayConfig || getDisplayConfigDefaults()),
        stagedDisplayDims: normalizedDims,
        stagedFixedIndices: nextFixedIndices,
        ...(applyImmediately
          ? {
              displayDims: normalizedDims,
              fixedIndices: nextFixedIndices,
            }
          : {}),
      },
      ...(applyImmediately ? {} : { matrixFullEnabled: false }),
    }));

    if (
      applyImmediately &&
      snapshot.route === "viewer" &&
      snapshot.viewMode === "display" &&
      snapshot.selectedNodeType === "dataset"
    ) {
      void actions.loadPreview(snapshot.selectedPath);
    }
  },

  setDisplayAxis(axis, dimValue) {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    if (shape.length < 2) {
      return;
    }

    const dim = toSafeInteger(dimValue, null);
    if (dim === null || dim < 0 || dim >= shape.length) {
      return;
    }

    const resolvedDims = resolveDisplayDimsFromConfig(snapshot.displayConfig, shape);
    if (!resolvedDims) {
      return;
    }

    const nextDims = [...resolvedDims];
    if (axis === "x") {
      nextDims[1] = dim;
    } else {
      nextDims[0] = dim;
    }

    if (nextDims[0] === nextDims[1]) {
      const movingIndex = axis === "x" ? 1 : 0;
      const partnerIndex = movingIndex === 1 ? 0 : 1;
      const replacement = getNextAvailableDim(shape.length, [nextDims[movingIndex]], nextDims[partnerIndex]);

      if (replacement !== null) {
        nextDims[partnerIndex] = replacement;
      }
    }

    actions.stageDisplayDims(nextDims, { applyImmediately: shape.length === 2 });
  },

  setDisplayDim(indexValue, dimValue) {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    if (shape.length < 2) {
      return;
    }

    const index = toSafeInteger(indexValue, null);
    const dim = toSafeInteger(dimValue, null);
    if ((index !== 0 && index !== 1) || dim === null || dim < 0 || dim >= shape.length) {
      return;
    }

    const resolvedDims = resolveDisplayDimsFromConfig(snapshot.displayConfig, shape);
    if (!resolvedDims) {
      return;
    }

    const nextDims = [...resolvedDims];
    nextDims[index] = dim;

    if (nextDims[0] === nextDims[1]) {
      const partnerIndex = index === 0 ? 1 : 0;
      const replacement = getNextAvailableDim(shape.length, [nextDims[index]], nextDims[partnerIndex]);
      if (replacement !== null) {
        nextDims[partnerIndex] = replacement;
      }
    }

    actions.stageDisplayDims(nextDims, { applyImmediately: shape.length === 2 });
  },

  stageFixedIndex(dim, value, size = null) {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    const dimIndex = toSafeInteger(dim, null);

    if (shape.length < 2 || dimIndex === null || dimIndex < 0 || dimIndex >= shape.length) {
      return;
    }

    const config = snapshot.displayConfig || getDisplayConfigDefaults();
    const stagedDims =
      normalizeDisplayDimsForShape(config.stagedDisplayDims, shape) ||
      normalizeDisplayDimsForShape(config.displayDims, shape) ||
      getDefaultDisplayDims(shape) ||
      [];

    if (stagedDims.includes(dimIndex)) {
      return;
    }

    const sourceSize = Math.max(0, toSafeInteger(size, shape[dimIndex]));
    const max = Math.max(0, sourceSize - 1);
    const normalizedValue = Math.max(0, Math.min(max, toSafeInteger(value, 0)));

    setState((prev) => {
      const prevConfig = prev.displayConfig || getDisplayConfigDefaults();
      const existing = normalizeFixedIndicesForShape(
        prevConfig.stagedFixedIndices,
        shape,
        stagedDims
      );

      return {
        displayConfig: {
          ...prevConfig,
          stagedFixedIndices: {
            ...existing,
            [dimIndex]: normalizedValue,
          },
        },
      };
    });
  },

  applyDisplayConfig() {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    if (shape.length < 2) {
      return;
    }

    const config = snapshot.displayConfig || getDisplayConfigDefaults();
    const nextDims =
      normalizeDisplayDimsForShape(config.stagedDisplayDims, shape) ||
      normalizeDisplayDimsForShape(config.displayDims, shape) ||
      getDefaultDisplayDims(shape);

    const nextFixedIndices = buildNextFixedIndices(
      config.stagedFixedIndices || config.fixedIndices,
      nextDims || [],
      shape
    );

    setState((prev) => ({
      displayConfig: {
        ...(prev.displayConfig || getDisplayConfigDefaults()),
        displayDims: nextDims,
        fixedIndices: nextFixedIndices,
        stagedDisplayDims: nextDims,
        stagedFixedIndices: nextFixedIndices,
      },
      matrixFullEnabled: false,
    }));

    if (
      snapshot.route === "viewer" &&
      snapshot.viewMode === "display" &&
      snapshot.selectedNodeType === "dataset"
    ) {
      void actions.loadPreview(snapshot.selectedPath);
    }
  },

  resetDisplayConfigFromPreview() {
    const snapshot = getState();
    const shape = normalizeShape(snapshot.preview?.shape);
    if (shape.length < 2) {
      return;
    }

    const defaultDims =
      normalizeDisplayDimsForShape(snapshot.preview?.display_dims, shape) || getDefaultDisplayDims(shape);
    const nextFixedIndices = buildNextFixedIndices(
      normalizeFixedIndicesForShape(snapshot.preview?.fixed_indices, shape, defaultDims || []),
      defaultDims || [],
      shape
    );

    setState((prev) => ({
      displayConfig: {
        ...(prev.displayConfig || getDisplayConfigDefaults()),
        stagedDisplayDims: defaultDims,
        stagedFixedIndices: nextFixedIndices,
      },
      matrixFullEnabled: false,
    }));
  },

  async loadMetadata(path = null) {
    const snapshot = getState();
    const targetPath = normalizePath(path || snapshot.selectedPath);

    if (!snapshot.selectedFile) {
      return null;
    }

    setState({
      metadataLoading: true,
      metadataError: null,
    });

    try {
      const response = await getFileMeta(snapshot.selectedFile, targetPath);
      const metadata = response.metadata || null;
      const latest = getState();

      if (
        latest.selectedFile === snapshot.selectedFile &&
        latest.selectedPath === targetPath &&
        latest.viewMode === "inspect"
      ) {
        setState((prev) => ({
          metadata,
          metadataLoading: false,
          metadataError: null,
          cacheResponses: {
            ...prev.cacheResponses,
            meta: {
              ...(prev.cacheResponses?.meta || {}),
              [targetPath]: metadata,
            },
          },
        }));
      }

      return metadata;
    } catch (error) {
      const latest = getState();
      if (
        latest.selectedFile === snapshot.selectedFile &&
        latest.selectedPath === targetPath &&
        latest.viewMode === "inspect"
      ) {
        setState({
          metadataLoading: false,
          metadataError: error.message || "Failed to load metadata",
        });
      }

      throw error;
    }
  },

  async loadPreview(path = null) {
    const snapshot = getState();
    const targetPath = normalizePath(path || snapshot.selectedPath);

    if (!snapshot.selectedFile) {
      return null;
    }

    const displayDimsParam = buildDisplayDimsParam(snapshot.displayConfig?.displayDims);
    const fixedIndicesParam = buildFixedIndicesParam(snapshot.displayConfig?.fixedIndices);
    const previewParams = {
      mode: "auto",
      max_size: 256,
    };

    if (displayDimsParam) {
      previewParams.display_dims = displayDimsParam;
    }

    if (fixedIndicesParam) {
      previewParams.fixed_indices = fixedIndicesParam;
    }

    setState({
      previewLoading: true,
      previewError: null,
      matrixFullEnabled: false,
    });

    try {
      const response = await getFilePreview(snapshot.selectedFile, targetPath, previewParams, {
        cancelPrevious: true,
      });
      const latest = getState();

      if (
        latest.selectedFile === snapshot.selectedFile &&
        latest.selectedPath === targetPath &&
        latest.viewMode === "display"
      ) {
        const shape = normalizeShape(response?.shape);
        const prevConfig = latest.displayConfig || getDisplayConfigDefaults();

        const nextAppliedDims =
          normalizeDisplayDimsForShape(prevConfig.displayDims, shape) ||
          normalizeDisplayDimsForShape(response?.display_dims, shape) ||
          getDefaultDisplayDims(shape);

        const currentAppliedFixed = normalizeFixedIndicesForShape(
          prevConfig.fixedIndices,
          shape,
          nextAppliedDims || []
        );
        const responseFixed = normalizeFixedIndicesForShape(
          response?.fixed_indices,
          shape,
          nextAppliedDims || []
        );
        const baseAppliedFixed =
          Object.keys(currentAppliedFixed).length > 0 ? currentAppliedFixed : responseFixed;
        const nextAppliedFixed = buildNextFixedIndices(
          baseAppliedFixed,
          nextAppliedDims || [],
          shape
        );

        const nextStagedDims =
          normalizeDisplayDimsForShape(prevConfig.stagedDisplayDims, shape) || nextAppliedDims;
        const stagedPendingDims = !areDisplayDimsEqual(nextStagedDims, nextAppliedDims);
        const currentStagedFixed = normalizeFixedIndicesForShape(
          prevConfig.stagedFixedIndices,
          shape,
          nextStagedDims || []
        );
        const stagedPendingFixed = !areFixedIndicesEqual(currentStagedFixed, nextAppliedFixed);
        const nextStagedFixed = buildNextFixedIndices(
          (stagedPendingDims || stagedPendingFixed) && Object.keys(currentStagedFixed).length > 0
            ? currentStagedFixed
            : nextAppliedFixed,
          nextStagedDims || [],
          shape
        );

        setState((prev) => ({
          preview: response,
          previewLoading: false,
          previewError: null,
          displayConfig: {
            ...(prev.displayConfig || getDisplayConfigDefaults()),
            displayDims: nextAppliedDims,
            fixedIndices: nextAppliedFixed,
            stagedDisplayDims: nextStagedDims,
            stagedFixedIndices: nextStagedFixed,
          },
          cacheResponses: {
            ...prev.cacheResponses,
            preview: {
              ...(prev.cacheResponses?.preview || {}),
              [targetPath]: response,
            },
          },
        }));
      }

      return response;
    } catch (error) {
      const latest = getState();
      if (
        latest.selectedFile === snapshot.selectedFile &&
        latest.selectedPath === targetPath &&
        latest.viewMode === "display"
      ) {
        setState({
          previewLoading: false,
          previewError: error.message || "Failed to load preview",
        });
      }

      throw error;
    }
  },
};
