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
        ...(nodeType === "group"
          ? {
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
    setState({ viewMode: mode });

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
    setState({ displayTab: nextTab });
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
    setState((prev) => ({
      displayConfig: {
        ...prev.displayConfig,
        ...displayConfigPatch,
      },
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

    setState({
      previewLoading: true,
      previewError: null,
    });

    try {
      const response = await getFilePreview(snapshot.selectedFile, targetPath, {}, { cancelPrevious: true });
      const latest = getState();

      if (
        latest.selectedFile === snapshot.selectedFile &&
        latest.selectedPath === targetPath &&
        latest.viewMode === "display"
      ) {
        setState((prev) => ({
          preview: response,
          previewLoading: false,
          previewError: null,
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
