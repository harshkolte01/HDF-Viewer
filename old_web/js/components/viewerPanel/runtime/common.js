const MATRIX_RUNTIME_CLEANUPS = new Set();
const LINE_RUNTIME_CLEANUPS = new Set();

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

export {
  MATRIX_RUNTIME_CLEANUPS,
  LINE_RUNTIME_CLEANUPS,
  clearViewerRuntimeBindings,
  ensureNodePool,
  setMatrixStatus,
};
