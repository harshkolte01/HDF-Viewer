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

function renderNode(node, state) {
  const path = String(node.path || "/");
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

  return `
    <li class="tree-node">
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
        nodeType === "group" && expanded
          ? `<ul class="tree-branch">${
              loaded
                ? (getChildren(state, path) || []).map((child) => renderNode(child, state)).join("")
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
        <div class="sidebar-tree">
          <ul class="tree-root">
            ${renderNode(treeRoot, state)}
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
}
