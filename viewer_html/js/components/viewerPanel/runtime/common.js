// Viewer HTML module: Manages runtime cleanup registries and shared DOM utilities for matrix, line, and heatmap runtimes.
(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/runtime/common.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/runtime/common.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel.runtime.common");
const MATRIX_RUNTIME_CLEANUPS = new Set();
const LINE_RUNTIME_CLEANUPS = new Set();
const HEATMAP_RUNTIME_CLEANUPS = new Set();

function clearViewerRuntimeBindings() {
  MATRIX_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  MATRIX_RUNTIME_CLEANUPS.clear();

  LINE_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  LINE_RUNTIME_CLEANUPS.clear();

  HEATMAP_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  HEATMAP_RUNTIME_CLEANUPS.clear();
}

function ensureNodePool(container, pool, count, className) {
  while (pool.length < count) {
    const node = document.createElement("div");
    node.className = className;
    container.appendChild(node);
    pool.push(node);
  }

  while (pool.length > count) {
    const node = pool.pop();
    if (node) {
      node.remove();
    }
  }
}

function setMatrixStatus(statusElement, message, tone = "info") {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.remove("error", "info");
  if (tone === "error") {
    statusElement.classList.add("error");
  } else if (tone === "info") {
    statusElement.classList.add("info");
  }
}
  if (typeof MATRIX_RUNTIME_CLEANUPS !== "undefined") {
    moduleState.MATRIX_RUNTIME_CLEANUPS = MATRIX_RUNTIME_CLEANUPS;
    global.MATRIX_RUNTIME_CLEANUPS = MATRIX_RUNTIME_CLEANUPS;
  }
  if (typeof LINE_RUNTIME_CLEANUPS !== "undefined") {
    moduleState.LINE_RUNTIME_CLEANUPS = LINE_RUNTIME_CLEANUPS;
    global.LINE_RUNTIME_CLEANUPS = LINE_RUNTIME_CLEANUPS;
  }
  if (typeof HEATMAP_RUNTIME_CLEANUPS !== "undefined") {
    moduleState.HEATMAP_RUNTIME_CLEANUPS = HEATMAP_RUNTIME_CLEANUPS;
    global.HEATMAP_RUNTIME_CLEANUPS = HEATMAP_RUNTIME_CLEANUPS;
  }
  if (typeof clearViewerRuntimeBindings !== "undefined") {
    moduleState.clearViewerRuntimeBindings = clearViewerRuntimeBindings;
    global.clearViewerRuntimeBindings = clearViewerRuntimeBindings;
  }
  if (typeof ensureNodePool !== "undefined") {
    moduleState.ensureNodePool = ensureNodePool;
    global.ensureNodePool = ensureNodePool;
  }
  if (typeof setMatrixStatus !== "undefined") {
    moduleState.setMatrixStatus = setMatrixStatus;
    global.setMatrixStatus = setMatrixStatus;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/runtime/common");
  }
})(typeof window !== "undefined" ? window : globalThis);
