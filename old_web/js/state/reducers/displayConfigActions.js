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
export function createDisplayConfigActions(deps) {
  const {
    actions,
    getState,
    setState,
    toSafeInteger,
    getDisplayConfigDefaults,
    normalizeShape,
    getDefaultDisplayDims,
    normalizeDisplayDimsForShape,
    normalizeFixedIndicesForShape,
    buildNextFixedIndices,
    resolveDisplayDimsFromConfig,
    getNextAvailableDim,
  } = unpackDeps(deps);

  return {
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
      ...(applyImmediately
        ? {}
        : { matrixFullEnabled: false, lineFullEnabled: false, heatmapFullEnabled: false }),
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
      lineFullEnabled: false,
      heatmapFullEnabled: false,
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
      lineFullEnabled: false,
      heatmapFullEnabled: false,
    }));
  },

  };
}
