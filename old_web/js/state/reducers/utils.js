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

export {
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
