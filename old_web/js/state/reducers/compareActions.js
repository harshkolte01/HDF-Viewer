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

const MAX_LINE_COMPARE_SERIES = 4;

function isNumericDtype(dtype) {
  const normalized = String(dtype || "").trim().toLowerCase();
  if (!normalized || normalized.includes("complex")) {
    return false;
  }
  return (
    normalized.includes("float") ||
    normalized.includes("int") ||
    normalized.includes("uint") ||
    normalized.includes("bool")
  );
}

function shapesMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  return a.every((entry, index) => Number(entry) === Number(b[index]));
}

export function createCompareActions(deps) {
  const { getState, setState, normalizePath, getNodeName, normalizeShape, toSafeInteger } =
    unpackDeps(deps);

  function buildStatus(tone, message) {
    return {
      tone: tone === "error" ? "error" : "info",
      message: String(message || "").trim(),
      timestamp: Date.now(),
    };
  }

  function parseShape(value) {
    if (Array.isArray(value)) {
      return normalizeShape(value);
    }
    if (typeof value !== "string") {
      return [];
    }
    return value
      .split(",")
      .map((entry) => toSafeInteger(entry, null))
      .filter((entry) => Number.isFinite(entry) && entry >= 0);
  }

  function normalizeCandidate(candidate) {
    const raw = candidate && typeof candidate === "object" ? candidate : {};
    const path = normalizePath(raw.path || "/");
    const shape = parseShape(raw.shape);
    const ndimFromShape = shape.length;
    const ndim = Math.max(0, toSafeInteger(raw.ndim, ndimFromShape));
    const dtype = String(raw.dtype || "").trim();
    const type = String(raw.type || "").toLowerCase();
    const name = String(raw.name || getNodeName(path) || path);
    return {
      path,
      shape,
      ndim,
      dtype,
      type,
      name,
    };
  }

  function lookupDatasetDescriptor(state, path) {
    if (!(state.childrenCache instanceof Map)) {
      return null;
    }

    const normalizedPath = normalizePath(path);
    for (const children of state.childrenCache.values()) {
      if (!Array.isArray(children)) {
        continue;
      }

      const hit = children.find(
        (entry) => normalizePath(entry?.path || "/") === normalizedPath && entry?.type === "dataset"
      );
      if (hit) {
        return normalizeCandidate({
          path: hit.path,
          shape: hit.shape,
          ndim: hit.ndim,
          dtype: hit.dtype,
          type: hit.type,
          name: hit.name,
        });
      }
    }
    return null;
  }

  function resolveBaseDescriptor(state) {
    const selectedPath = normalizePath(state.selectedPath || "/");
    const preview =
      state.preview && normalizePath(state.preview.path || "/") === selectedPath ? state.preview : null;

    if (preview) {
      return normalizeCandidate({
        path: selectedPath,
        shape: preview.shape,
        ndim: preview.ndim,
        dtype: preview.dtype,
        type: "dataset",
        name: getNodeName(selectedPath),
      });
    }

    return lookupDatasetDescriptor(state, selectedPath);
  }

  function validateCandidate(base, candidate) {
    if (!candidate || candidate.type !== "dataset") {
      return "Only dataset nodes can be compared.";
    }

    if (!candidate.path || candidate.path === "/") {
      return "Invalid dataset path for comparison.";
    }

    if (candidate.path === base.path) {
      return "Base dataset is already plotted.";
    }

    if (!isNumericDtype(base.dtype)) {
      return "Base dataset is not numeric and cannot be compared.";
    }

    if (!isNumericDtype(candidate.dtype)) {
      return `${candidate.name} is not numeric and cannot be compared.`;
    }

    if (!Number.isFinite(base.ndim) || !Number.isFinite(candidate.ndim)) {
      return "Dataset dimensionality metadata is missing.";
    }

    if (base.ndim !== candidate.ndim) {
      return `${candidate.name} has ${candidate.ndim}D while base is ${base.ndim}D.`;
    }

    if (!Array.isArray(base.shape) || !Array.isArray(candidate.shape)) {
      return "Dataset shape metadata is missing.";
    }

    if (!shapesMatch(base.shape, candidate.shape)) {
      return `${candidate.name} shape [${candidate.shape.join(" x ")}] does not match base [${base.shape.join(
        " x "
      )}].`;
    }

    return null;
  }

  return {
    toggleLineCompare(value = null) {
      const snapshot = getState();
      const nextValue = typeof value === "boolean" ? value : !snapshot.lineCompareEnabled;
      setState({
        lineCompareEnabled: nextValue,
        lineCompareStatus: null,
      });
    },

    clearLineCompare() {
      setState({
        lineCompareItems: [],
        lineCompareStatus: buildStatus("info", "Comparison selection cleared."),
      });
    },

    removeLineCompareDataset(path) {
      const normalizedPath = normalizePath(path || "/");
      setState((prev) => {
        const currentItems = Array.isArray(prev.lineCompareItems) ? prev.lineCompareItems : [];
        const nextItems = currentItems.filter(
          (entry) => normalizePath(entry?.path || "/") !== normalizedPath
        );
        return {
          lineCompareItems: nextItems,
          lineCompareStatus: buildStatus("info", "Dataset removed from comparison."),
        };
      });
    },

    dismissLineCompareStatus() {
      setState({ lineCompareStatus: null });
    },

    addLineCompareDataset(candidate) {
      const snapshot = getState();
      if (snapshot.route !== "viewer" || snapshot.viewMode !== "display" || snapshot.displayTab !== "line") {
        setState({
          lineCompareStatus: buildStatus("error", "Comparison is only available in line display mode."),
        });
        return;
      }

      if (!snapshot.lineCompareEnabled) {
        setState({
          lineCompareStatus: buildStatus("error", "Enable compare mode before adding datasets."),
        });
        return;
      }

      const normalizedCandidate = normalizeCandidate(candidate);
      const currentItems = Array.isArray(snapshot.lineCompareItems) ? snapshot.lineCompareItems : [];
      if (
        currentItems.some(
          (entry) => normalizePath(entry?.path || "/") === normalizePath(normalizedCandidate.path)
        )
      ) {
        setState({
          lineCompareStatus: buildStatus("info", `${normalizedCandidate.name} is already selected.`),
        });
        return;
      }

      if (currentItems.length >= MAX_LINE_COMPARE_SERIES) {
        setState({
          lineCompareStatus: buildStatus(
            "error",
            `Up to ${MAX_LINE_COMPARE_SERIES} datasets can be compared at once.`
          ),
        });
        return;
      }

      const baseDescriptor = resolveBaseDescriptor(snapshot);
      if (!baseDescriptor) {
        setState({
          lineCompareStatus: buildStatus("error", "Load the base dataset preview before comparing."),
        });
        return;
      }

      const reason = validateCandidate(baseDescriptor, normalizedCandidate);
      if (reason) {
        setState({
          lineCompareStatus: buildStatus("error", reason),
        });
        return;
      }

      setState((prev) => {
        const nextItems = Array.isArray(prev.lineCompareItems) ? [...prev.lineCompareItems] : [];
        nextItems.push({
          path: normalizedCandidate.path,
          name: normalizedCandidate.name,
          dtype: normalizedCandidate.dtype,
          ndim: normalizedCandidate.ndim,
          shape: normalizedCandidate.shape,
          type: "dataset",
        });

        return {
          lineCompareItems: nextItems,
          lineCompareStatus: buildStatus(
            "info",
            `${normalizedCandidate.name} added for comparison (${nextItems.length}/${MAX_LINE_COMPARE_SERIES}).`
          ),
        };
      });
    },
  };
}
