import { escapeHtml } from "../utils/format.js";

function getChildren(state, path) {
  if (!(state.childrenCache instanceof Map)) {
    return null;
  }
  return state.childrenCache.has(path) ? state.childrenCache.get(path) : null;
}

function hasPath(state, path) {
  return state.childrenCache instanceof Map && state.childrenCache.has(path);
}

function isExpanded(state, path) {
  return state.expandedPaths instanceof Set && state.expandedPaths.has(path);
}

function isLoading(state, path) {
  return state.treeLoadingPaths instanceof Set && state.treeLoadingPaths.has(path);
}

function getError(state, path) {
  if (!(state.treeErrors instanceof Map)) {
    return null;
  }
  return state.treeErrors.get(path) || null;
}

function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }
  const normalized = `/${String(path).replace(/^\/+/, "").replace(/\/+/g, "/")}`;
  return normalized.endsWith("/") && normalized.length > 1
    ? normalized.slice(0, -1)
    : normalized;
}

function normalizeShape(shape) {
  if (!Array.isArray(shape)) {
    return [];
  }
  return shape
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

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

function lookupDatasetFromCache(state, targetPath) {
  const normalizedTargetPath = normalizePath(targetPath);
  if (!(state.childrenCache instanceof Map)) {
    return null;
  }

  for (const children of state.childrenCache.values()) {
    if (!Array.isArray(children)) {
      continue;
    }

    const hit = children.find((entry) => {
      return entry?.type === "dataset" && normalizePath(entry?.path || "/") === normalizedTargetPath;
    });

    if (hit) {
      return {
        path: normalizePath(hit.path || normalizedTargetPath),
        dtype: String(hit.dtype || ""),
        shape: normalizeShape(hit.shape),
        ndim: Number(hit.ndim),
      };
    }
  }

  return null;
}

function getBaseDatasetForCompare(state) {
  const selectedPath = normalizePath(state.selectedPath || "/");
  if (selectedPath === "/") {
    return null;
  }

  const preview =
    state.preview && normalizePath(state.preview.path || "/") === selectedPath ? state.preview : null;
  if (preview) {
    const shape = normalizeShape(preview.shape);
    const ndim = Number.isFinite(Number(preview.ndim)) ? Number(preview.ndim) : shape.length;
    return {
      path: selectedPath,
      dtype: String(preview.dtype || ""),
      shape,
      ndim,
    };
  }

  return lookupDatasetFromCache(state, selectedPath);
}

function shapesMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => Number(entry) === Number(right[index]));
}

function isDatasetCompatibleWithBase(baseDataset, candidateDataset) {
  if (!baseDataset || !candidateDataset) {
    return false;
  }
  if (!isNumericDtype(baseDataset.dtype) || !isNumericDtype(candidateDataset.dtype)) {
    return false;
  }
  if (!Number.isFinite(baseDataset.ndim) || !Number.isFinite(candidateDataset.ndim)) {
    return false;
  }
  if (baseDataset.ndim !== candidateDataset.ndim) {
    return false;
  }
  return shapesMatch(baseDataset.shape, candidateDataset.shape);
}

function renderStatus(state, path) {
  const loading = isLoading(state, path);
  const error = getError(state, path);

  if (loading) {
    return '<li class="tree-status">Loading...</li>';
  }

  if (error) {
    return `
      <li class="tree-status error">
        <span>${escapeHtml(error)}</span>
        <button class="tree-retry-btn" data-tree-retry-path="${escapeHtml(path)}" type="button">Retry</button>
      </li>
    `;
  }

  if (hasPath(state, path)) {
    const children = getChildren(state, path) || [];
    if (!children.length) {
      return '<li class="tree-status">No items</li>';
    }
  }

  return "";
}

function renderNode(node, state, compareContext = null) {
  const path = normalizePath(node.path || "/");
  const nodeType = node.type === "dataset" ? "dataset" : "group";
  const name = node.name || (path === "/" ? state.selectedFile || "root" : path.split("/").filter(Boolean).pop());
  const selected = state.selectedPath === path ? "active" : "";
  const expanded = nodeType === "group" && isExpanded(state, path);
  const loaded = nodeType === "group" && hasPath(state, path);
  const caretClass = [
    "tree-caret",
    nodeType === "group" ? "" : "is-leaf",
    expanded ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const iconClass = nodeType === "group" ? "tree-icon is-group" : "tree-icon is-dataset";
  const count = Number(node.num_children) || 0;
  const compareMode = Boolean(compareContext?.enabled) && nodeType === "dataset";
  const candidateDataset = compareMode
    ? {
        path,
        dtype: String(node.dtype || ""),
        shape: normalizeShape(node.shape),
        ndim: Number(node.ndim),
      }
    : null;
  const comparePathSet = compareContext?.pathSet || new Set();
  const alreadyCompared = comparePathSet.has(path);
  const isBaseDataset = nodeType === "dataset" && state.selectedPath === path;
  const isCompatibleCandidate =
    compareMode && !isBaseDataset
      ? isDatasetCompatibleWithBase(compareContext?.baseDataset || null, candidateDataset)
      : false;
  const showCompareControl = compareMode && (isBaseDataset || alreadyCompared || isCompatibleCandidate);
  const compareButtonLabel = isBaseDataset ? "Base" : alreadyCompared ? "Added" : "Compare";
  const compareShape = Array.isArray(candidateDataset?.shape) ? candidateDataset.shape.join(",") : "";
  const compareDtype = node.dtype || "";
  const compareNdim = Number.isFinite(Number(candidateDataset?.ndim))
    ? Number(candidateDataset.ndim)
    : "";

  return `
    <li class="tree-node">
      <div class="tree-row-wrap">
        <button class="tree-row ${selected}" type="button"
            data-tree-select-path="${escapeHtml(path)}"
            data-tree-select-type="${escapeHtml(nodeType)}"
            data-tree-select-name="${escapeHtml(name)}"
          >
            ${
              nodeType === "group"
                ? `<span class="${caretClass}" data-tree-toggle-path="${escapeHtml(path)}"></span>`
                : `<span class="${caretClass}"></span>`
            }
            <span class="${iconClass}" aria-hidden="true"></span>
            <span class="tree-label">${escapeHtml(name)}</span>
            ${nodeType === "group" && count > 0 ? `<span class="tree-count">${count}</span>` : ""}
        </button>
        ${
          showCompareControl
            ? `<button
                  type="button"
                  class="tree-compare-btn ${isBaseDataset || alreadyCompared ? "is-disabled" : ""}"
                  data-tree-compare-add-path="${escapeHtml(path)}"
                  data-tree-compare-add-name="${escapeHtml(name)}"
                  data-tree-compare-add-type="${escapeHtml(nodeType)}"
                  data-tree-compare-add-dtype="${escapeHtml(compareDtype)}"
                  data-tree-compare-add-shape="${escapeHtml(compareShape)}"
                  data-tree-compare-add-ndim="${escapeHtml(compareNdim)}"
                  title="${
                    isBaseDataset
                      ? "Base dataset currently plotted"
                      : alreadyCompared
                      ? "Already added to comparison"
                      : "Add dataset to line comparison"
                  }"
                  ${isBaseDataset || alreadyCompared ? "disabled" : ""}
                >${compareButtonLabel}</button>`
            : ""
        }
      </div>
        ${
          nodeType === "group" && expanded
            ? `<ul class="tree-branch">${
                loaded
                  ? (getChildren(state, path) || [])
                      .map((child) => renderNode(child, state, compareContext))
                      .join("")
                  : ""
              }${renderStatus(state, path)}</ul>`
            : ""
        }
    </li>
  `;
}

export function renderSidebarTree(state) {
  const treeRoot = {
    type: "group",
    name: state.selectedFile || "root",
    path: "/",
    num_children: (getChildren(state, "/") || []).length,
  };
  const compareTreeScrollEnabled =
    state.route === "viewer" &&
    state.viewMode === "display" &&
    state.displayTab === "line" &&
    state.lineCompareEnabled === true;
  const compareItems = Array.isArray(state.lineCompareItems) ? state.lineCompareItems : [];
  const comparePathSet = new Set(
    compareItems.map((entry) => normalizePath(entry?.path || "/"))
  );
  const compareContext = {
    enabled: compareTreeScrollEnabled,
    baseDataset: compareTreeScrollEnabled ? getBaseDatasetForCompare(state) : null,
    pathSet: comparePathSet,
  };

  return `
    <aside class="viewer-sidebar">
      <div class="sidebar-top">
        <div class="sidebar-top-row">
          <div class="sidebar-title">${escapeHtml(state.selectedFile || "HDF Viewer")}</div>
          <button class="sidebar-close-btn" id="sidebar-close-btn" type="button" aria-label="Close sidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="4" y1="4" x2="14" y2="14"/><line x1="14" y1="4" x2="4" y2="14"/>
            </svg>
          </button>
        </div>
        ${state.selectedFile ? '<div class="file-pill">Active file</div>' : ""}
      </div>
      <div class="sidebar-section">
        <div class="section-label">Structure</div>
        <div class="sidebar-tree ${compareTreeScrollEnabled ? "is-compare-mode" : ""}">
          <ul class="tree-root">
            ${renderNode(treeRoot, state, compareContext)}
          </ul>
        </div>
      </div>
    </aside>
  `;
}

export function bindSidebarTreeEvents(root, actions) {
  root.querySelectorAll("[data-tree-toggle-path]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      actions.toggleTreePath(button.dataset.treeTogglePath || "/");
    });
  });

  root.querySelectorAll("[data-tree-retry-path]").forEach((button) => {
    button.addEventListener("click", () => {
      void actions.loadTreeChildren(button.dataset.treeRetryPath || "/", { force: true });
    });
  });

  root.querySelectorAll("[data-tree-select-path]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.selectTreeNode({
        path: button.dataset.treeSelectPath || "/",
        type: button.dataset.treeSelectType || "group",
        name: button.dataset.treeSelectName || "",
      });
    });
  });

  root.querySelectorAll("[data-tree-compare-add-path]").forEach((button) => {
    const onCompareAdd = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) {
        return;
      }

      const shape = String(button.dataset.treeCompareAddShape || "")
        .split(",")
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry >= 0);

      actions.addLineCompareDataset({
        path: button.dataset.treeCompareAddPath || "/",
        name: button.dataset.treeCompareAddName || "",
        type: button.dataset.treeCompareAddType || "dataset",
        dtype: button.dataset.treeCompareAddDtype || "",
        ndim: Number(button.dataset.treeCompareAddNdim),
        shape,
      });
    };

    button.addEventListener("click", onCompareAdd);
  });
}
