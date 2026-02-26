function unpackDeps(deps) {
  const { actions, getState, setState, api, utils } = deps;
  const { getFiles, refreshFiles, getFileChildren, getFileMeta, getFilePreview } = api;
  const {
    normalizePath,
    getAncestorPaths,
    getNodeName,
    toSafeInteger,
    getDisplayConfigDefaults,
    normalizeShape,
    getDefaultDisplayDims,
    normalizeDisplayDimsForShape,
    normalizeFixedIndicesForShape,
    buildNextFixedIndices,
    buildDisplayDimsParam,
    buildFixedIndicesParam,
    areDisplayDimsEqual,
    areFixedIndicesEqual,
    resolveDisplayDimsFromConfig,
    getNextAvailableDim,
  } = utils;

  return {
    actions,
    getState,
    setState,
    getFiles,
    refreshFiles,
    getFileChildren,
    getFileMeta,
    getFilePreview,
    normalizePath,
    getAncestorPaths,
    getNodeName,
    toSafeInteger,
    getDisplayConfigDefaults,
    normalizeShape,
    getDefaultDisplayDims,
    normalizeDisplayDimsForShape,
    normalizeFixedIndicesForShape,
    buildNextFixedIndices,
    buildDisplayDimsParam,
    buildFixedIndicesParam,
    areDisplayDimsEqual,
    areFixedIndicesEqual,
    resolveDisplayDimsFromConfig,
    getNextAvailableDim,
  };
}
export function createFileActions(deps) {
  const {
    actions,
    getState,
    setState,
    getFiles,
    refreshFiles,
    getDisplayConfigDefaults,
  } = unpackDeps(deps);

  return {
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
      selectedFileBucket: selection.bucket || null,
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
      previewRequestKey: null,
      previewRequestInFlight: false,
      viewMode: "inspect",
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
      displayConfig: getDisplayConfigDefaults(),
    });

    void actions.loadTreeChildren("/");
  },

  goHome() {
    setState({
      route: "home",
      selectedPath: "/",
      lineCompareEnabled: false,
      lineCompareItems: [],
      lineCompareStatus: null,
    });
  },

  setSearchQuery(searchQuery) {
    setState({ searchQuery });
  },

  setSelectedPath(path) {
    return actions.onBreadcrumbSelect(path);
  },

  };
}
