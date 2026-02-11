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
export function createDataActions(deps) {
  const {
    getState,
    setState,
    getFileMeta,
    getFilePreview,
    getDisplayConfigDefaults,
    normalizePath,
    normalizeShape,
    getDefaultDisplayDims,
    normalizeDisplayDimsForShape,
    normalizeFixedIndicesForShape,
    buildNextFixedIndices,
    buildDisplayDimsParam,
    buildFixedIndicesParam,
    areDisplayDimsEqual,
    areFixedIndicesEqual,
  } = unpackDeps(deps);

  return {
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
      lineFullEnabled: false,
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
}
