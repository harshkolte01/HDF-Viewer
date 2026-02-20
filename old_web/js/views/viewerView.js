import { escapeHtml } from "../utils/format.js";
import { renderSidebarTree, bindSidebarTreeEvents } from "../components/sidebarTree.js";
import { renderViewerPanel, bindViewerPanelEvents } from "../components/viewerPanel.js?v=20260220-7";
import { loadTemplate, applyTemplate } from "../utils/templateLoader.js";

const VIEWER_TEMPLATE_FALLBACK = `
  <div class="viewer-page">
    {{VIEWER_SIDEBAR}}
    <section class="viewer-main">
      {{VIEWER_TOPBAR}}
      {{VIEWER_SUBBAR}}
      {{VIEWER_PANEL}}
    </section>
  </div>
`;

let viewerTemplate = VIEWER_TEMPLATE_FALLBACK;

export async function initViewerViewTemplate() {
  try {
    const template = await loadTemplate("viewer");
    if (template) {
      viewerTemplate = template;
    }
  } catch (error) {
    console.warn("Using fallback viewer template.", error);
  }
}

function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }

  const normalized = `/${String(path).replace(/^\/+/, "").replace(/\/+$/g, "")}`;
  return normalized || "/";
}

function getBreadcrumbSegments(path) {
  const normalized = normalizePath(path);
  const parts = normalized === "/" ? [] : normalized.split("/").filter(Boolean);
  let current = "";

  return parts.map((part) => {
    current += `/${part}`;
    return {
      label: part,
      path: current,
    };
  });
}

function renderViewerTopBar(state) {
  const segments = getBreadcrumbSegments(state.selectedPath);
  const fileCrumbActive = segments.length === 0 ? "active" : "";

  return `
    <div class="viewer-topbar">
      <div class="topbar-left">
        <button id="sidebar-toggle-btn" class="sidebar-toggle-btn" type="button" aria-label="Toggle sidebar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="5" x2="17" y2="5"/>
            <line x1="3" y1="10" x2="17" y2="10"/>
            <line x1="3" y1="15" x2="17" y2="15"/>
          </svg>
        </button>
        <div class="topbar-path">
          <div class="breadcrumb-label">File location</div>
          <div class="breadcrumb">
          <button class="crumb crumb-btn ${fileCrumbActive}" data-breadcrumb-path="/" type="button">${escapeHtml(
    state.selectedFile || "Unknown"
  )}</button>
          ${segments
            .map((segment, index) => {
              const active = index === segments.length - 1 ? "active" : "";
              return `<button class="crumb crumb-btn ${active}" data-breadcrumb-path="${escapeHtml(
                segment.path
              )}" type="button">${escapeHtml(segment.label)}</button>`;
            })
            .join("")}
        </div>
        </div>
      </div>

      <div class="topbar-right">
        <button id="viewer-back-btn" class="ghost-btn" type="button">
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 2 4 8 10 14"/></svg>
          <span class="btn-label">Back to files</span>
        </button>
        <button id="viewer-fullscreen-btn" class="ghost-btn" type="button" title="Toggle fullscreen">
          <svg class="btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>
          <span class="btn-label">Fullscreen</span>
        </button>
        <div class="segmented">
          <button
            class="seg-btn ${state.viewMode === "display" ? "active" : ""}"
            data-view-mode="display"
            type="button"
          >
            Display
          </button>
          <button
            class="seg-btn ${state.viewMode === "inspect" ? "active" : ""}"
            data-view-mode="inspect"
            type="button"
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderPreviewToolbar(state) {
  const activeTab = state.displayTab || "line";
  const disabled = state.selectedNodeType !== "dataset" || state.previewLoading;
  const showHeatmap = Number(state.preview?.ndim || 0) >= 2;

  return `
    <div class="viewer-subbar">
      <div class="subbar-tabs">
        <button type="button" class="subbar-tab ${activeTab === "table" ? "active" : ""}" data-display-tab="table" ${
    disabled ? "disabled" : ""
  }>
          Matrix
        </button>
        <button type="button" class="subbar-tab ${activeTab === "line" ? "active" : ""}" data-display-tab="line" ${
    disabled ? "disabled" : ""
  }>
          Line Graph
        </button>
        ${
          showHeatmap
            ? `<button type="button" class="subbar-tab ${
                activeTab === "heatmap" ? "active" : ""
              }" data-display-tab="heatmap" ${disabled ? "disabled" : ""}>Heatmap</button>`
            : ""
        }
      </div>

      ${
        activeTab === "line"
          ? `<div class="subbar-actions">
               <button type="button" class="subbar-toggle ${
                 state.lineGrid ? "active" : ""
               }" data-line-grid-toggle="true" ${disabled ? "disabled" : ""}>Grid</button>
               <div class="aspect-group">
                 <span class="aspect-label">Aspect</span>
                 <div class="aspect-tabs">
                   ${["line", "point", "both"]
                     .map(
                       (value) =>
                         `<button type="button" class="aspect-tab ${
                           state.lineAspect === value ? "active" : ""
                         }" data-line-aspect="${value}" ${disabled ? "disabled" : ""}>${
                           value.charAt(0).toUpperCase() + value.slice(1)
                         }</button>`
                     )
                     .join("")}
                 </div>
               </div>
               <button type="button" class="subbar-export" ${disabled ? "disabled" : ""}>Export</button>
             </div>`
          : activeTab === "heatmap"
          ? `<div class="subbar-actions">
               <button type="button" class="subbar-toggle ${
                 state.heatmapGrid ? "active" : ""
               }" data-heatmap-grid-toggle="true" ${disabled ? "disabled" : ""}>Grid</button>
               <div class="colormap-group">
                 <span class="colormap-label">Color</span>
                 <div class="colormap-tabs">
                   ${["viridis", "plasma", "inferno", "magma", "cool", "hot"]
                     .map(
                       (value) =>
                         `<button type="button" class="colormap-tab ${
                           state.heatmapColormap === value ? "active" : ""
                         }" data-heatmap-colormap="${value}" ${disabled ? "disabled" : ""}>${
                           value.charAt(0).toUpperCase() + value.slice(1)
                         }</button>`
                     )
                     .join("")}
                 </div>
               </div>
               <button type="button" class="subbar-export" ${disabled ? "disabled" : ""}>Export</button>
             </div>`
          : `<div class="subbar-actions">
               <div class="notation-group">
                 <span class="notation-label">Notation</span>
                 <div class="notation-tabs">
                   ${["auto", "scientific", "exact"]
                     .map(
                       (value) =>
                         `<button type="button" class="notation-tab ${
                           state.notation === value ? "active" : ""
                         }" data-notation="${value}" ${disabled ? "disabled" : ""}>${
                           value.charAt(0).toUpperCase() + value.slice(1)
                         }</button>`
                     )
                     .join("")}
                 </div>
               </div>
               <button type="button" class="subbar-export" ${disabled ? "disabled" : ""}>Export</button>
             </div>`
      }
    </div>
  `;
}

export function renderViewerView(state) {
  const sidebarClass = state.sidebarOpen ? "sidebar-open" : "sidebar-collapsed";
  const html = applyTemplate(viewerTemplate, {
    VIEWER_SIDEBAR: renderSidebarTree(state),
    VIEWER_TOPBAR: renderViewerTopBar(state),
    VIEWER_SUBBAR: state.viewMode === "display" ? renderPreviewToolbar(state) : "",
    VIEWER_PANEL: renderViewerPanel(state),
  });
  /* Inject sidebar-open/collapsed class and backdrop onto .viewer-page */
  return html.replace(
    'class="viewer-page"',
    `class="viewer-page ${sidebarClass}"`
  ) + (state.sidebarOpen ? '<div class="sidebar-backdrop" id="sidebar-backdrop"></div>' : '');
}

export function bindViewerViewEvents(root, actions) {
  /* Sidebar toggle / close / backdrop */
  const sidebarToggle = root.querySelector("#sidebar-toggle-btn");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", actions.toggleSidebar);
  }
  const sidebarClose = root.querySelector("#sidebar-close-btn");
  if (sidebarClose) {
    sidebarClose.addEventListener("click", () => actions.setSidebarOpen(false));
  }
  const backdrop = document.getElementById("sidebar-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => actions.setSidebarOpen(false));
  }

  const backButton = root.querySelector("#viewer-back-btn");
  if (backButton) {
    backButton.addEventListener("click", actions.goHome);
  }

  /* Global fullscreen â€” fullscreens the entire viewer page */
  const globalFsBtn = root.querySelector("#viewer-fullscreen-btn");
  if (globalFsBtn) {
    const viewerPage = root.querySelector(".viewer-page") || root.closest(".viewer-page");
    const fullscreenTarget = viewerPage || document.documentElement;
    const isViewerFullscreen = () => document.fullscreenElement === fullscreenTarget;

    const updateGlobalFsLabel = () => {
      const isFs = isViewerFullscreen();
      const label = globalFsBtn.querySelector(".btn-label");
      if (label) label.textContent = isFs ? "Exit Fullscreen" : "Fullscreen";
      globalFsBtn.title = isFs ? "Exit fullscreen" : "Toggle fullscreen";
      const path = globalFsBtn.querySelector("svg path");
      if (path) {
        path.setAttribute("d", isFs
          ? "M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3"
          : "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
        );
      }
    };
    const onGlobalFsClick = async () => {
      try {
        if (isViewerFullscreen()) {
          await document.exitFullscreen();
          return;
        }

        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }

        if (fullscreenTarget.requestFullscreen) {
          await fullscreenTarget.requestFullscreen();
        }
      } catch (_e) { /* ignore */ }
    };
    globalFsBtn.addEventListener("click", onGlobalFsClick);
    document.addEventListener("fullscreenchange", updateGlobalFsLabel);
  }

  root.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setViewMode(button.dataset.viewMode || "inspect");
    });
  });

  root.querySelectorAll("[data-breadcrumb-path]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.onBreadcrumbSelect(button.dataset.breadcrumbPath || "/");
    });
  });

  root.querySelectorAll("[data-display-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setDisplayTab(button.dataset.displayTab || "line");
    });
  });

  root.querySelectorAll("[data-notation]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setNotation(button.dataset.notation || "auto");
    });
  });

  root.querySelectorAll("[data-line-grid-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.toggleLineGrid();
    });
  });

  root.querySelectorAll("[data-line-aspect]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setLineAspect(button.dataset.lineAspect || "line");
    });
  });

  root.querySelectorAll("[data-heatmap-grid-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.toggleHeatmapGrid();
    });
  });

  root.querySelectorAll("[data-heatmap-colormap]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setHeatmapColormap(button.dataset.heatmapColormap || "viridis");
    });
  });

  bindSidebarTreeEvents(root, actions);
  bindViewerPanelEvents(root, actions);
}

