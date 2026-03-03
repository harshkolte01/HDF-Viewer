(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/render/config.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/render/config.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel.render.config");
function buildLineSelectionKey(fileKey, path, displayDimsParam, fixedIndicesParam, lineIndex) {
  return [
    fileKey || "no-file",
    path || "/",
    displayDimsParam || "none",
    fixedIndicesParam || "none",
    lineIndex ?? "auto",
  ].join("|");
}

function resolveLineRuntimeConfig(state, preview) {
  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const dims = controls.appliedDisplayDims;
  const fixedIndices = controls.appliedFixedIndices || {};

  if (!shape.length) {
    return {
      supported: false,
      totalPoints: 0,
      rowCount: 0,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey: "",
    };
  }

  if (shape.length === 1) {
    const totalPoints = Math.max(0, toSafeInteger(shape[0], 0));
    const selectionKey = buildLineSelectionKey(
      state.selectedFile,
      state.selectedPath,
      "",
      "",
      null
    );

    return {
      supported: totalPoints > 0,
      totalPoints,
      rowCount: 1,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey,
    };
  }

  if (!Array.isArray(dims) || dims.length !== 2) {
    return {
      supported: false,
      totalPoints: 0,
      rowCount: 0,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey: "",
    };
  }

  const rowDim = dims[0];
  const colDim = dims[1];
  const rowCount = Math.max(0, toSafeInteger(shape[rowDim], 0));
  const totalPoints = Math.max(0, toSafeInteger(shape[colDim], 0));
  const lineIndex = rowCount > 0 ? Math.floor(rowCount / 2) : null;
  const displayDimsParam = buildDisplayDimsParam(dims);
  const fixedIndicesParam = buildFixedIndicesParam(fixedIndices);
  const selectionKey = buildLineSelectionKey(
    state.selectedFile,
    state.selectedPath,
    displayDimsParam,
    fixedIndicesParam,
    lineIndex
  );

  return {
    supported: rowCount > 0 && totalPoints > 0,
    totalPoints,
    rowCount,
    displayDimsParam,
    fixedIndicesParam,
    lineIndex,
    selectionKey,
  };
}

function buildMatrixSelectionKey(fileKey, path, displayDimsParam, fixedIndicesParam) {
  return [
    fileKey || "no-file",
    path || "/",
    displayDimsParam || "none",
    fixedIndicesParam || "none",
  ].join("|");
}

function buildMatrixBlockKey(selectionKey, rowOffset, colOffset, rowLimit, colLimit) {
  return `${selectionKey}|r${rowOffset}|c${colOffset}|rl${rowLimit}|cl${colLimit}|rs1|cs1`;
}

function buildHeatmapSelectionKey(fileKey, path, displayDimsParam, fixedIndicesParam) {
  return [
    fileKey || "no-file",
    path || "/",
    displayDimsParam || "none",
    fixedIndicesParam || "none",
  ].join("|");
}

function resolveHeatmapRuntimeConfig(state, preview) {
  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const displayDims = controls.appliedDisplayDims;
  const fixedIndices = controls.appliedFixedIndices || {};

  if (!Array.isArray(displayDims) || displayDims.length !== 2 || shape.length < 2) {
    return {
      supported: false,
      rows: 0,
      cols: 0,
      displayDimsParam: "",
      fixedIndicesParam: "",
      selectionKey: "",
    };
  }

  const rowDim = displayDims[0];
  const colDim = displayDims[1];
  const rows = Math.max(0, toSafeInteger(shape[rowDim], 0));
  const cols = Math.max(0, toSafeInteger(shape[colDim], 0));
  const displayDimsParam = buildDisplayDimsParam(displayDims);
  const fixedIndicesParam = buildFixedIndicesParam(fixedIndices);
  const selectionKey = buildHeatmapSelectionKey(
    state.selectedFile,
    state.selectedPath,
    displayDimsParam,
    fixedIndicesParam
  );

  return {
    supported: true,
    rows,
    cols,
    displayDimsParam,
    fixedIndicesParam,
    selectionKey,
  };
}

function resolveMatrixRuntimeConfig(state, preview) {
  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const displayDims = controls.appliedDisplayDims;
  const fixedIndices = controls.appliedFixedIndices || {};

  if (!Array.isArray(displayDims) || displayDims.length !== 2 || shape.length < 2) {
    return {
      supported: false,
      rows: 0,
      cols: 0,
      blockRows: 160,
      blockCols: 40,
      displayDimsParam: "",
      fixedIndicesParam: "",
      selectionKey: "",
    };
  }

  const rowDim = displayDims[0];
  const colDim = displayDims[1];
  const rows = Math.max(0, toSafeInteger(shape[rowDim], 0));
  const cols = Math.max(0, toSafeInteger(shape[colDim], 0));
  const blockRows = Math.max(1, Math.min(2000, toSafeInteger(state.matrixBlockSize?.rows, 160)));
  const blockCols = Math.max(1, Math.min(2000, toSafeInteger(state.matrixBlockSize?.cols, 40)));
  const displayDimsParam = buildDisplayDimsParam(displayDims);
  const fixedIndicesParam = buildFixedIndicesParam(fixedIndices);
  const selectionKey = buildMatrixSelectionKey(
    state.selectedFile,
    state.selectedPath,
    displayDimsParam,
    fixedIndicesParam
  );

  return {
    supported: true,
    rows,
    cols,
    blockRows,
    blockCols,
    displayDimsParam,
    fixedIndicesParam,
    selectionKey,
  };
}
  if (typeof buildLineSelectionKey !== "undefined") {
    moduleState.buildLineSelectionKey = buildLineSelectionKey;
    global.buildLineSelectionKey = buildLineSelectionKey;
  }
  if (typeof resolveLineRuntimeConfig !== "undefined") {
    moduleState.resolveLineRuntimeConfig = resolveLineRuntimeConfig;
    global.resolveLineRuntimeConfig = resolveLineRuntimeConfig;
  }
  if (typeof buildMatrixSelectionKey !== "undefined") {
    moduleState.buildMatrixSelectionKey = buildMatrixSelectionKey;
    global.buildMatrixSelectionKey = buildMatrixSelectionKey;
  }
  if (typeof buildMatrixBlockKey !== "undefined") {
    moduleState.buildMatrixBlockKey = buildMatrixBlockKey;
    global.buildMatrixBlockKey = buildMatrixBlockKey;
  }
  if (typeof buildHeatmapSelectionKey !== "undefined") {
    moduleState.buildHeatmapSelectionKey = buildHeatmapSelectionKey;
    global.buildHeatmapSelectionKey = buildHeatmapSelectionKey;
  }
  if (typeof resolveHeatmapRuntimeConfig !== "undefined") {
    moduleState.resolveHeatmapRuntimeConfig = resolveHeatmapRuntimeConfig;
    global.resolveHeatmapRuntimeConfig = resolveHeatmapRuntimeConfig;
  }
  if (typeof resolveMatrixRuntimeConfig !== "undefined") {
    moduleState.resolveMatrixRuntimeConfig = resolveMatrixRuntimeConfig;
    global.resolveMatrixRuntimeConfig = resolveMatrixRuntimeConfig;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/render/config");
  }
})(typeof window !== "undefined" ? window : globalThis);