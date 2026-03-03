(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/shared.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/shared.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel.shared");
const MATRIX_ROW_HEIGHT = 28;
const MATRIX_COL_WIDTH = 96;
const MATRIX_HEADER_HEIGHT = 28;
const MATRIX_INDEX_WIDTH = 60;
const MATRIX_OVERSCAN = 4;
const MATRIX_BLOCK_CACHE = new LruCache(1600);
const MATRIX_PENDING = new Set();
const LINE_VIEW_CACHE = new LruCache(240);
const LINE_FETCH_DEBOUNCE_MS = 220;
const LINE_MIN_VIEW_SPAN = 64;
const LINE_SVG_WIDTH = 980;
const LINE_SVG_HEIGHT = 340;
const LINE_DEFAULT_QUALITY = "auto";
const LINE_DEFAULT_OVERVIEW_MAX_POINTS = 5000;
const LINE_EXACT_MAX_POINTS = 20000;
const LINE_WINDOW_OPTIONS = [256, 512, 1000, 2000, 5000, 10000, 20000];
const LINE_KEYBOARD_PAN_RATIO = 0.25;

function toSafeInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLineQuality(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "overview" || normalized === "exact" || normalized === "auto") {
    return normalized;
  }
  return LINE_DEFAULT_QUALITY;
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

function normalizeDisplayDims(displayDims, shape) {
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

function normalizeFixedIndices(fixedIndices, shape, displayDims = []) {
  const hidden = new Set(Array.isArray(displayDims) ? displayDims : []);
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
      hidden.has(dim)
    ) {
      return;
    }

    const max = Math.max(0, shape[dim] - 1);
    normalized[dim] = clamp(index, 0, max);
  });

  return normalized;
}

function buildNextFixedIndices(currentIndices, displayDims, shape) {
  const dims = Array.isArray(displayDims) ? displayDims : [];
  const next = normalizeFixedIndices(currentIndices, shape, dims);
  const hidden = new Set(dims);

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

    next[dim] = clamp(toSafeInteger(next[dim], fallback), 0, max);
  });

  return next;
}

function areDimsEqual(a, b) {
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
    return key === otherKey && Number(left[key]) === Number(right[key]);
  });
}

function buildDisplayDimsParam(displayDims) {
  if (!Array.isArray(displayDims) || displayDims.length !== 2) {
    return "";
  }

  return `${displayDims[0]},${displayDims[1]}`;
}

function buildFixedIndicesParam(fixedIndices) {
  if (!fixedIndices || typeof fixedIndices !== "object") {
    return "";
  }

  const entries = Object.entries(fixedIndices)
    .map(([dim, index]) => [toSafeInteger(dim, null), toSafeInteger(index, null)])
    .filter(([dim, index]) => dim !== null && index !== null)
    .sort(([a], [b]) => a - b);

  if (!entries.length) {
    return "";
  }

  return entries.map(([dim, index]) => `${dim}=${index}`).join(",");
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(" x ");
  }

  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatCell(value, notation = "auto") {
  if (value === null || value === undefined) {
    return "--";
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    if (notation === "exact") {
      return String(value);
    }

    if (notation === "scientific") {
      return asNumber.toExponential(4);
    }

    const abs = Math.abs(asNumber);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) {
      return asNumber.toExponential(3);
    }

    return asNumber.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  return String(value);
}

function formatTypeDescription(typeInfo) {
  if (!typeInfo || typeof typeInfo === "string") {
    return typeInfo || "Unknown";
  }

  const parts = [];
  if (typeInfo.class) parts.push(typeInfo.class);
  if (typeInfo.signed !== undefined) parts.push(typeInfo.signed ? "signed" : "unsigned");
  if (typeInfo.size) parts.push(`${typeInfo.size}-bit`);
  if (typeInfo.endianness) parts.push(typeInfo.endianness);

  return parts.join(", ");
}

let axisLabelMeasureContext = null;

function measureAxisLabelWidth(text) {
  const value = String(text ?? "");
  if (!value) {
    return 0;
  }

  if (typeof document === "undefined") {
    return value.length * 7;
  }

  if (!axisLabelMeasureContext) {
    const canvas = document.createElement("canvas");
    axisLabelMeasureContext = canvas.getContext("2d");
  }

  if (!axisLabelMeasureContext) {
    return value.length * 7;
  }

  axisLabelMeasureContext.font =
    "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  return axisLabelMeasureContext.measureText(value).width;
}

function resolveDisplayControls(state, preview) {
  const shape = normalizeShape(preview?.shape);
  const config = state.displayConfig || {};

  const appliedDisplayDims =
    normalizeDisplayDims(config.displayDims, shape) ||
    normalizeDisplayDims(preview?.display_dims, shape) ||
    getDefaultDisplayDims(shape);
  const stagedDisplayDims =
    normalizeDisplayDims(config.stagedDisplayDims, shape) || appliedDisplayDims;

  const appliedFixedIndices = buildNextFixedIndices(
    normalizeFixedIndices(config.fixedIndices, shape, appliedDisplayDims || []),
    appliedDisplayDims || [],
    shape
  );

  const stagedBase =
    Object.keys(config.stagedFixedIndices || {}).length > 0
      ? config.stagedFixedIndices
      : appliedFixedIndices;
  const stagedFixedIndices = buildNextFixedIndices(
    normalizeFixedIndices(stagedBase, shape, stagedDisplayDims || []),
    stagedDisplayDims || [],
    shape
  );

  const hasPendingChanges =
    !areDimsEqual(stagedDisplayDims, appliedDisplayDims) ||
    !areFixedIndicesEqual(stagedFixedIndices, appliedFixedIndices);

  return {
    shape,
    appliedDisplayDims,
    appliedFixedIndices,
    stagedDisplayDims,
    stagedFixedIndices,
    hasPendingChanges,
  };
}
  if (typeof MATRIX_ROW_HEIGHT !== "undefined") {
    moduleState.MATRIX_ROW_HEIGHT = MATRIX_ROW_HEIGHT;
    global.MATRIX_ROW_HEIGHT = MATRIX_ROW_HEIGHT;
  }
  if (typeof MATRIX_COL_WIDTH !== "undefined") {
    moduleState.MATRIX_COL_WIDTH = MATRIX_COL_WIDTH;
    global.MATRIX_COL_WIDTH = MATRIX_COL_WIDTH;
  }
  if (typeof MATRIX_HEADER_HEIGHT !== "undefined") {
    moduleState.MATRIX_HEADER_HEIGHT = MATRIX_HEADER_HEIGHT;
    global.MATRIX_HEADER_HEIGHT = MATRIX_HEADER_HEIGHT;
  }
  if (typeof MATRIX_INDEX_WIDTH !== "undefined") {
    moduleState.MATRIX_INDEX_WIDTH = MATRIX_INDEX_WIDTH;
    global.MATRIX_INDEX_WIDTH = MATRIX_INDEX_WIDTH;
  }
  if (typeof MATRIX_OVERSCAN !== "undefined") {
    moduleState.MATRIX_OVERSCAN = MATRIX_OVERSCAN;
    global.MATRIX_OVERSCAN = MATRIX_OVERSCAN;
  }
  if (typeof MATRIX_BLOCK_CACHE !== "undefined") {
    moduleState.MATRIX_BLOCK_CACHE = MATRIX_BLOCK_CACHE;
    global.MATRIX_BLOCK_CACHE = MATRIX_BLOCK_CACHE;
  }
  if (typeof MATRIX_PENDING !== "undefined") {
    moduleState.MATRIX_PENDING = MATRIX_PENDING;
    global.MATRIX_PENDING = MATRIX_PENDING;
  }
  if (typeof LINE_VIEW_CACHE !== "undefined") {
    moduleState.LINE_VIEW_CACHE = LINE_VIEW_CACHE;
    global.LINE_VIEW_CACHE = LINE_VIEW_CACHE;
  }
  if (typeof LINE_FETCH_DEBOUNCE_MS !== "undefined") {
    moduleState.LINE_FETCH_DEBOUNCE_MS = LINE_FETCH_DEBOUNCE_MS;
    global.LINE_FETCH_DEBOUNCE_MS = LINE_FETCH_DEBOUNCE_MS;
  }
  if (typeof LINE_MIN_VIEW_SPAN !== "undefined") {
    moduleState.LINE_MIN_VIEW_SPAN = LINE_MIN_VIEW_SPAN;
    global.LINE_MIN_VIEW_SPAN = LINE_MIN_VIEW_SPAN;
  }
  if (typeof LINE_SVG_WIDTH !== "undefined") {
    moduleState.LINE_SVG_WIDTH = LINE_SVG_WIDTH;
    global.LINE_SVG_WIDTH = LINE_SVG_WIDTH;
  }
  if (typeof LINE_SVG_HEIGHT !== "undefined") {
    moduleState.LINE_SVG_HEIGHT = LINE_SVG_HEIGHT;
    global.LINE_SVG_HEIGHT = LINE_SVG_HEIGHT;
  }
  if (typeof LINE_DEFAULT_QUALITY !== "undefined") {
    moduleState.LINE_DEFAULT_QUALITY = LINE_DEFAULT_QUALITY;
    global.LINE_DEFAULT_QUALITY = LINE_DEFAULT_QUALITY;
  }
  if (typeof LINE_DEFAULT_OVERVIEW_MAX_POINTS !== "undefined") {
    moduleState.LINE_DEFAULT_OVERVIEW_MAX_POINTS = LINE_DEFAULT_OVERVIEW_MAX_POINTS;
    global.LINE_DEFAULT_OVERVIEW_MAX_POINTS = LINE_DEFAULT_OVERVIEW_MAX_POINTS;
  }
  if (typeof LINE_EXACT_MAX_POINTS !== "undefined") {
    moduleState.LINE_EXACT_MAX_POINTS = LINE_EXACT_MAX_POINTS;
    global.LINE_EXACT_MAX_POINTS = LINE_EXACT_MAX_POINTS;
  }
  if (typeof LINE_WINDOW_OPTIONS !== "undefined") {
    moduleState.LINE_WINDOW_OPTIONS = LINE_WINDOW_OPTIONS;
    global.LINE_WINDOW_OPTIONS = LINE_WINDOW_OPTIONS;
  }
  if (typeof LINE_KEYBOARD_PAN_RATIO !== "undefined") {
    moduleState.LINE_KEYBOARD_PAN_RATIO = LINE_KEYBOARD_PAN_RATIO;
    global.LINE_KEYBOARD_PAN_RATIO = LINE_KEYBOARD_PAN_RATIO;
  }
  if (typeof toSafeInteger !== "undefined") {
    moduleState.toSafeInteger = toSafeInteger;
    global.toSafeInteger = toSafeInteger;
  }
  if (typeof clamp !== "undefined") {
    moduleState.clamp = clamp;
    global.clamp = clamp;
  }
  if (typeof normalizeLineQuality !== "undefined") {
    moduleState.normalizeLineQuality = normalizeLineQuality;
    global.normalizeLineQuality = normalizeLineQuality;
  }
  if (typeof normalizeShape !== "undefined") {
    moduleState.normalizeShape = normalizeShape;
    global.normalizeShape = normalizeShape;
  }
  if (typeof getDefaultDisplayDims !== "undefined") {
    moduleState.getDefaultDisplayDims = getDefaultDisplayDims;
    global.getDefaultDisplayDims = getDefaultDisplayDims;
  }
  if (typeof normalizeDisplayDims !== "undefined") {
    moduleState.normalizeDisplayDims = normalizeDisplayDims;
    global.normalizeDisplayDims = normalizeDisplayDims;
  }
  if (typeof normalizeFixedIndices !== "undefined") {
    moduleState.normalizeFixedIndices = normalizeFixedIndices;
    global.normalizeFixedIndices = normalizeFixedIndices;
  }
  if (typeof buildNextFixedIndices !== "undefined") {
    moduleState.buildNextFixedIndices = buildNextFixedIndices;
    global.buildNextFixedIndices = buildNextFixedIndices;
  }
  if (typeof areDimsEqual !== "undefined") {
    moduleState.areDimsEqual = areDimsEqual;
    global.areDimsEqual = areDimsEqual;
  }
  if (typeof areFixedIndicesEqual !== "undefined") {
    moduleState.areFixedIndicesEqual = areFixedIndicesEqual;
    global.areFixedIndicesEqual = areFixedIndicesEqual;
  }
  if (typeof buildDisplayDimsParam !== "undefined") {
    moduleState.buildDisplayDimsParam = buildDisplayDimsParam;
    global.buildDisplayDimsParam = buildDisplayDimsParam;
  }
  if (typeof buildFixedIndicesParam !== "undefined") {
    moduleState.buildFixedIndicesParam = buildFixedIndicesParam;
    global.buildFixedIndicesParam = buildFixedIndicesParam;
  }
  if (typeof formatValue !== "undefined") {
    moduleState.formatValue = formatValue;
    global.formatValue = formatValue;
  }
  if (typeof formatCell !== "undefined") {
    moduleState.formatCell = formatCell;
    global.formatCell = formatCell;
  }
  if (typeof formatTypeDescription !== "undefined") {
    moduleState.formatTypeDescription = formatTypeDescription;
    global.formatTypeDescription = formatTypeDescription;
  }
  if (typeof measureAxisLabelWidth !== "undefined") {
    moduleState.measureAxisLabelWidth = measureAxisLabelWidth;
    global.measureAxisLabelWidth = measureAxisLabelWidth;
  }
  if (typeof resolveDisplayControls !== "undefined") {
    moduleState.resolveDisplayControls = resolveDisplayControls;
    global.resolveDisplayControls = resolveDisplayControls;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/shared");
  }
})(typeof window !== "undefined" ? window : globalThis);