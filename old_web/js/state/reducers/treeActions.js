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
export function createTreeActions(deps) {
  const {
    actions,
    getState,
    setState,
    getFileChildren,
    normalizePath,
    getAncestorPaths,
    getNodeName,
    getDisplayConfigDefaults,
  } = unpackDeps(deps);

  return {
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
        lineFullEnabled: false,
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
        lineFullEnabled: false,
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

  };
}
