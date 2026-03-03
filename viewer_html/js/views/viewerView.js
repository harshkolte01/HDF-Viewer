(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for views/viewerView.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading views/viewerView.");
    return;
  }

  var moduleState = ensurePath(ns, "views.viewerView");

  var REQUIRED_DOM_IDS = [
    "viewer-app",
    "viewer-sidebar",
    "sidebar-header",
    "tree-panel",
    "tree-list",
    "tree-status",
    "viewer-main",
    "viewer-topbar",
    "breadcrumb-file",
    "breadcrumb-path",
    "viewer-subbar",
    "subbar-tabs",
    "subbar-actions",
    "viewer-panel",
    "display-pane",
    "inspect-pane",
    "display-status",
    "inspect-status",
    "global-status",
    "sidebar-backdrop",
    "sidebar-toggle-btn",
    "sidebar-close-btn",
    "viewer-back-btn",
    "viewer-fullscreen-btn",
  ];

  var disposeViewerViewBindings = null;

  function collectDomRefs(rootDoc) {
    var doc = rootDoc || document;
    return {
      viewerApp: doc.getElementById("viewer-app"),
      viewerSidebar: doc.getElementById("viewer-sidebar"),
      sidebarHeader: doc.getElementById("sidebar-header"),
      treePanel: doc.getElementById("tree-panel"),
      treeList: doc.getElementById("tree-list"),
      treeStatus: doc.getElementById("tree-status"),
      viewerMain: doc.getElementById("viewer-main"),
      viewerTopbar: doc.getElementById("viewer-topbar"),
      breadcrumbFile: doc.getElementById("breadcrumb-file"),
      breadcrumbPath: doc.getElementById("breadcrumb-path"),
      viewerSubbar: doc.getElementById("viewer-subbar"),
      subbarTabs: doc.getElementById("subbar-tabs"),
      subbarActions: doc.getElementById("subbar-actions"),
      viewerPanel: doc.getElementById("viewer-panel"),
      displayPane: doc.getElementById("display-pane"),
      inspectPane: doc.getElementById("inspect-pane"),
      displayStatus: doc.getElementById("display-status"),
      inspectStatus: doc.getElementById("inspect-status"),
      globalStatus: doc.getElementById("global-status"),
      sidebarBackdrop: doc.getElementById("sidebar-backdrop"),
      sidebarToggleBtn: doc.getElementById("sidebar-toggle-btn"),
      sidebarCloseBtn: doc.getElementById("sidebar-close-btn"),
      viewerBackBtn: doc.getElementById("viewer-back-btn"),
      viewerFullscreenBtn: doc.getElementById("viewer-fullscreen-btn"),
    };
  }

  function validateViewerDomIds(rootDoc) {
    var doc = rootDoc || document;
    var missing = [];

    for (var i = 0; i < REQUIRED_DOM_IDS.length; i += 1) {
      var id = REQUIRED_DOM_IDS[i];
      if (!doc.getElementById(id)) {
        missing.push(id);
      }
    }

    if (missing.length > 0) {
      console.error(
        "[HDFViewer] Missing required viewer DOM ids:",
        missing.join(", ")
      );
      return {
        ok: false,
        missing: missing,
      };
    }

    return {
      ok: true,
      missing: [],
    };
  }

  function setStatus(element, message, tone) {
    if (!element) {
      return;
    }

    element.textContent = String(message || "");
    element.classList.remove("error", "info");
    if (tone === "error") {
      element.classList.add("error");
    } else if (tone === "info") {
      element.classList.add("info");
    }
  }

  function stripSingleRoot(html) {
    var markup = typeof html === "string" ? html.trim() : "";
    if (!markup) {
      return "";
    }

    var template = document.createElement("template");
    template.innerHTML = markup;
    var firstElement = template.content.firstElementChild;

    if (!firstElement) {
      return markup;
    }

    return firstElement.innerHTML;
  }

  function clearViewerViewBindings() {
    if (typeof disposeViewerViewBindings !== "function") {
      return;
    }

    try {
      disposeViewerViewBindings();
    } catch (_error) {
      // ignore cleanup errors from detached nodes
    } finally {
      disposeViewerViewBindings = null;
    }
  }

  async function initViewerViewTemplate() {
    return Promise.resolve();
  }

  function normalizePath(path) {
    if (!path || path === "/") {
      return "/";
    }

    var normalized = "/" + String(path).replace(/^\/+/, "").replace(/\/+$/g, "");
    return normalized || "/";
  }

  function getBreadcrumbSegments(path) {
    var normalized = normalizePath(path);
    var parts = normalized === "/" ? [] : normalized.split("/").filter(Boolean);
    var current = "";

    return parts.map(function (part) {
      current += "/" + part;
      return {
        label: part,
        path: current,
      };
    });
  }

  function renderViewerTopBar(state) {
    var segments = getBreadcrumbSegments(state.selectedPath);
    var fileCrumbActive = segments.length === 0 ? "active" : "";

    return `
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
          <div id="breadcrumb-path" class="breadcrumb">
          <button id="breadcrumb-file" class="crumb crumb-btn ${fileCrumbActive}" data-breadcrumb-path="/" type="button">${escapeHtml(
      state.selectedFile || "Unknown"
    )}</button>
          ${segments
            .map(function (segment, index) {
              var active = index === segments.length - 1 ? "active" : "";
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
    `;
  }

  function renderExportMenu(target, disabled) {
    var targetKey = String(target || "").trim().toLowerCase();
    var options =
      targetKey === "line" || targetKey === "heatmap"
        ? [
            { action: "csv-displayed", label: "CSV (Displayed)" },
            { action: "csv-full", label: "CSV (Full)" },
            { action: "png-current", label: "PNG (Current View)" },
          ]
        : [
            { action: "csv-displayed", label: "CSV (Displayed)" },
            { action: "csv-full", label: "CSV (Full)" },
          ];

    return `
      <div class="subbar-export-wrap" data-export-root="true">
        <button
          type="button"
          class="subbar-export"
          data-export-toggle="true"
          aria-haspopup="menu"
          aria-expanded="false"
          ${disabled ? "disabled" : ""}
        >
          Export
        </button>
        <div class="subbar-export-menu" data-export-menu="true" role="menu" aria-hidden="true">
          ${options
            .map(function (option) {
              return `
                <button
                  type="button"
                  class="subbar-export-item"
                  data-export-target="${escapeHtml(targetKey || "matrix")}" 
                  data-export-action="${escapeHtml(option.action)}"
                  role="menuitem"
                  ${disabled ? "disabled" : ""}
                >
                  ${escapeHtml(option.label)}
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderPreviewToolbar(state) {
    var activeTab = state.displayTab || "line";
    var disabled = state.selectedNodeType !== "dataset" || state.previewLoading;
    var showHeatmap = Number(state.preview && state.preview.ndim || 0) >= 2;

    return `
      <div id="subbar-tabs" class="subbar-tabs">
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
          ? `<div id="subbar-actions" class="subbar-actions">
               <button type="button" class="subbar-toggle ${
                 state.lineGrid ? "active" : ""
               }" data-line-grid-toggle="true" ${disabled ? "disabled" : ""}>Grid</button>
               <div class="aspect-group">
                 <span class="aspect-label">Aspect</span>
                 <div class="aspect-tabs">
                   ${["line", "point", "both"]
                     .map(function (value) {
                       return `<button type="button" class="aspect-tab ${
                         state.lineAspect === value ? "active" : ""
                       }" data-line-aspect="${value}" ${disabled ? "disabled" : ""}>${
                         value.charAt(0).toUpperCase() + value.slice(1)
                       }</button>`;
                     })
                     .join("")}
                 </div>
               </div>
               ${renderExportMenu("line", disabled)}
             </div>`
          : activeTab === "heatmap"
          ? `<div id="subbar-actions" class="subbar-actions">
               <button type="button" class="subbar-toggle ${
                 state.heatmapGrid ? "active" : ""
               }" data-heatmap-grid-toggle="true" ${disabled ? "disabled" : ""}>Grid</button>
               <div class="colormap-group">
                 <span class="colormap-label">Color</span>
                 <div class="colormap-tabs">
                   ${["viridis", "plasma", "inferno", "magma", "cool", "hot"]
                     .map(function (value) {
                       return `<button type="button" class="colormap-tab ${
                         state.heatmapColormap === value ? "active" : ""
                       }" data-heatmap-colormap="${value}" ${disabled ? "disabled" : ""}>${
                         value.charAt(0).toUpperCase() + value.slice(1)
                       }</button>`;
                     })
                     .join("")}
                 </div>
               </div>
               ${renderExportMenu("heatmap", disabled)}
             </div>`
          : `<div id="subbar-actions" class="subbar-actions">
               <div class="notation-group">
                 <span class="notation-label">Notation</span>
                 <div class="notation-tabs">
                   ${["auto", "scientific", "exact"]
                     .map(function (value) {
                       return `<button type="button" class="notation-tab ${
                         state.notation === value ? "active" : ""
                       }" data-notation="${value}" ${disabled ? "disabled" : ""}>${
                         value.charAt(0).toUpperCase() + value.slice(1)
                       }</button>`;
                     })
                     .join("")}
                 </div>
               </div>
               ${renderExportMenu("matrix", disabled)}
             </div>`
      }
    `;
  }

  function renderMissingFilePanel(exampleUrl) {
    var example = exampleUrl || "?file=<url-encoded-object-key>&bucket=<bucket-name>";
    return `
      <div class="panel-state">
        <div class="state-title">Missing <code>file</code> query parameter</div>
        <div class="state-text">Open viewer using <code>${escapeHtml(example)}</code>.</div>
      </div>
    `;
  }

  function renderViewerView(state, options) {
    var opts = options && typeof options === "object" ? options : {};
    var validation = validateViewerDomIds(document);

    if (!validation.ok) {
      return "";
    }

    var refs = collectDomRefs(document);
    var missingFile = opts.missingFile === true;

    refs.viewerApp.classList.toggle("sidebar-open", !!state.sidebarOpen);
    refs.viewerApp.classList.toggle("sidebar-collapsed", !state.sidebarOpen);

    refs.sidebarBackdrop.style.display = state.sidebarOpen ? "" : "none";

    refs.viewerSidebar.innerHTML = stripSingleRoot(renderSidebarTree(state));
    refs.viewerTopbar.innerHTML = renderViewerTopBar(state);

    if (state.viewMode === "display") {
      refs.viewerSubbar.hidden = false;
      refs.viewerSubbar.innerHTML = renderPreviewToolbar(state);
    } else {
      refs.viewerSubbar.hidden = true;
      refs.viewerSubbar.innerHTML =
        '<div id="subbar-tabs" class="subbar-tabs"></div><div id="subbar-actions" class="subbar-actions"></div>';
    }

    var panelInner = stripSingleRoot(renderViewerPanel(state));
    if (state.viewMode === "display") {
      refs.displayPane.hidden = false;
      refs.inspectPane.hidden = true;
      refs.displayPane.innerHTML = panelInner;
      refs.inspectPane.innerHTML = "";
    } else {
      refs.displayPane.hidden = true;
      refs.inspectPane.hidden = false;
      refs.displayPane.innerHTML = "";
      refs.inspectPane.innerHTML = panelInner;
    }

    setStatus(refs.displayStatus, state.previewError || "", state.previewError ? "error" : "info");
    setStatus(refs.inspectStatus, state.metadataError || "", state.metadataError ? "error" : "info");

    if (missingFile) {
      var panelHtml = renderMissingFilePanel(opts.deepLinkExample);
      refs.displayPane.hidden = false;
      refs.inspectPane.hidden = false;
      refs.displayPane.innerHTML = panelHtml;
      refs.inspectPane.innerHTML = panelHtml;
      setStatus(refs.treeStatus, "Provide file query parameter to load tree.", "info");
      setStatus(refs.globalStatus, "Viewer is blocked until ?file= is provided.", "error");
    } else {
      setStatus(refs.treeStatus, "", "info");
      setStatus(refs.globalStatus, "", "info");
    }

    return "";
  }

  function bindViewerViewEvents(root, actions) {
    clearViewerViewBindings();

    var safeRoot = root || document.getElementById("viewer-app") || document;
    var safeActions = actions && typeof actions === "object" ? actions : {};
    var cleanupFns = [];

    var sidebarToggle = safeRoot.querySelector("#sidebar-toggle-btn");
    if (sidebarToggle && typeof safeActions.toggleSidebar === "function") {
      sidebarToggle.addEventListener("click", safeActions.toggleSidebar);
    }

    var sidebarClose = safeRoot.querySelector("#sidebar-close-btn");
    if (sidebarClose && typeof safeActions.setSidebarOpen === "function") {
      sidebarClose.addEventListener("click", function () {
        safeActions.setSidebarOpen(false);
      });
    }

    var backdrop = document.getElementById("sidebar-backdrop");
    if (backdrop && typeof safeActions.setSidebarOpen === "function") {
      backdrop.addEventListener("click", function () {
        safeActions.setSidebarOpen(false);
      });
    }

    var backButton = safeRoot.querySelector("#viewer-back-btn");
    if (backButton && typeof safeActions.goHome === "function") {
      backButton.addEventListener("click", safeActions.goHome);
    }

    var globalFsBtn = safeRoot.querySelector("#viewer-fullscreen-btn");
    if (globalFsBtn) {
      var viewerPage = document.getElementById("viewer-app") || safeRoot;
      var fullscreenTarget = viewerPage || document.documentElement;
      var isViewerFullscreen = function () {
        return document.fullscreenElement === fullscreenTarget;
      };

      var updateGlobalFsLabel = function () {
        var isFs = isViewerFullscreen();
        var label = globalFsBtn.querySelector(".btn-label");
        if (label) {
          label.textContent = isFs ? "Exit Fullscreen" : "Fullscreen";
        }
        globalFsBtn.title = isFs ? "Exit fullscreen" : "Toggle fullscreen";
        var path = globalFsBtn.querySelector("svg path");
        if (path) {
          path.setAttribute(
            "d",
            isFs
              ? "M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3"
              : "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
          );
        }
      };

      var onGlobalFsClick = async function () {
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
        } catch (_e) {
          // ignore
        }
      };

      globalFsBtn.addEventListener("click", onGlobalFsClick);
      document.addEventListener("fullscreenchange", updateGlobalFsLabel);
      updateGlobalFsLabel();

      cleanupFns.push(function () {
        globalFsBtn.removeEventListener("click", onGlobalFsClick);
        document.removeEventListener("fullscreenchange", updateGlobalFsLabel);
      });
    }

    safeRoot.querySelectorAll("[data-view-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.setViewMode === "function") {
          safeActions.setViewMode(button.dataset.viewMode || "inspect");
        }
      });
    });

    safeRoot.querySelectorAll("[data-breadcrumb-path]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.onBreadcrumbSelect === "function") {
          safeActions.onBreadcrumbSelect(button.dataset.breadcrumbPath || "/");
        }
      });
    });

    safeRoot.querySelectorAll("[data-display-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.setDisplayTab === "function") {
          safeActions.setDisplayTab(button.dataset.displayTab || "line");
        }
      });
    });

    safeRoot.querySelectorAll("[data-notation]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.setNotation === "function") {
          safeActions.setNotation(button.dataset.notation || "auto");
        }
      });
    });

    safeRoot.querySelectorAll("[data-line-grid-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.toggleLineGrid === "function") {
          safeActions.toggleLineGrid();
        }
      });
    });

    safeRoot.querySelectorAll("[data-line-aspect]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.setLineAspect === "function") {
          safeActions.setLineAspect(button.dataset.lineAspect || "line");
        }
      });
    });

    safeRoot.querySelectorAll("[data-heatmap-grid-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.toggleHeatmapGrid === "function") {
          safeActions.toggleHeatmapGrid();
        }
      });
    });

    safeRoot.querySelectorAll("[data-heatmap-colormap]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof safeActions.setHeatmapColormap === "function") {
          safeActions.setHeatmapColormap(button.dataset.heatmapColormap || "viridis");
        }
      });
    });

    var exportRoots = Array.from(safeRoot.querySelectorAll("[data-export-root]"));
    var exportActionButtons = Array.from(safeRoot.querySelectorAll("[data-export-action]"));
    exportActionButtons.forEach(function (button) {
      button.dataset.exportBaseDisabled = button.disabled ? "1" : "0";
    });

    var exportRunning = false;
    var setExportRunning = function (running) {
      exportRunning = running === true;
      exportActionButtons.forEach(function (button) {
        var baseDisabled = button.dataset.exportBaseDisabled === "1";
        button.disabled = exportRunning || baseDisabled;
      });
    };

    var closeAllExportMenus = function () {
      exportRoots.forEach(function (menuRoot) {
        var menu = menuRoot.querySelector("[data-export-menu]");
        var toggle = menuRoot.querySelector("[data-export-toggle]");
        if (menu) {
          menu.setAttribute("aria-hidden", "true");
        }
        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
        }
        menuRoot.classList.remove("is-open");
      });
    };

    var resolveExportShell = function (target) {
      var targetKey = String(target || "").toLowerCase();
      if (targetKey === "matrix") {
        return safeRoot.querySelector("[data-matrix-shell]");
      }
      if (targetKey === "line") {
        return safeRoot.querySelector("[data-line-shell]");
      }
      if (targetKey === "heatmap") {
        return safeRoot.querySelector("[data-heatmap-shell]");
      }
      return null;
    };

    var resolveStatusElement = function (target) {
      var targetKey = String(target || "").toLowerCase();
      if (targetKey === "matrix") {
        return safeRoot.querySelector("[data-matrix-status]");
      }
      if (targetKey === "line") {
        return safeRoot.querySelector("[data-line-status]");
      }
      if (targetKey === "heatmap") {
        return safeRoot.querySelector("[data-heatmap-status]");
      }
      return null;
    };

    var setExportStatus = function (target, message, tone) {
      var statusElement = resolveStatusElement(target);
      if (!statusElement) {
        return;
      }
      statusElement.textContent = message;
      statusElement.classList.remove("error", "info");
      if (tone === "error") {
        statusElement.classList.add("error");
      } else {
        statusElement.classList.add("info");
      }
    };

    var resolveExportHandler = function (exportApi, action) {
      if (!exportApi || typeof exportApi !== "object") {
        return null;
      }
      var normalizedAction = String(action || "");
      if (normalizedAction === "csv-displayed") {
        return exportApi.exportCsvDisplayed;
      }
      if (normalizedAction === "csv-full") {
        return exportApi.exportCsvFull;
      }
      if (normalizedAction === "png-current") {
        return exportApi.exportPng;
      }
      return null;
    };

    var runExportAction = async function (target, action) {
      var shell = resolveExportShell(target);
      var targetLabel =
        target === "matrix" ? "matrix view" : target === "line" ? "line chart" : "heatmap";
      if (!shell || !shell.__exportApi) {
        setExportStatus(target, "Load full " + targetLabel + " before exporting.", "error");
        return;
      }

      var handler = resolveExportHandler(shell.__exportApi, action);
      if (typeof handler !== "function") {
        setExportStatus(target, "Export option not available for " + targetLabel + ".", "error");
        return;
      }

      setExportStatus(target, "Preparing export...", "info");
      setExportRunning(true);
      try {
        await handler();
      } catch (error) {
        setExportStatus(target, (error && error.message) || "Export failed.", "error");
      } finally {
        setExportRunning(false);
      }
    };

    exportRoots.forEach(function (menuRoot) {
      var toggle = menuRoot.querySelector("[data-export-toggle]");
      var menu = menuRoot.querySelector("[data-export-menu]");
      if (!toggle || !menu) {
        return;
      }

      var setOpen = function (open) {
        var isOpen = open === true;
        menu.setAttribute("aria-hidden", isOpen ? "false" : "true");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
        menuRoot.classList.toggle("is-open", isOpen);
      };

      var onToggle = function (event) {
        event.preventDefault();
        event.stopPropagation();
        var nextOpen = !menuRoot.classList.contains("is-open");
        closeAllExportMenus();
        setOpen(nextOpen);
      };

      toggle.addEventListener("click", onToggle);
      cleanupFns.push(function () {
        toggle.removeEventListener("click", onToggle);
      });
    });

    safeRoot.querySelectorAll("[data-export-action]").forEach(function (button) {
      var onExportClick = async function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (exportRunning) {
          return;
        }
        closeAllExportMenus();
        var target = String(button.dataset.exportTarget || "");
        var action = String(button.dataset.exportAction || "");
        if (!target || !action) {
          return;
        }
        await runExportAction(target, action);
      };

      button.addEventListener("click", onExportClick);
      cleanupFns.push(function () {
        button.removeEventListener("click", onExportClick);
      });
    });

    var onDocumentClick = function (event) {
      if (!event.target || !(event.target instanceof Element)) {
        closeAllExportMenus();
        return;
      }
      if (!event.target.closest("[data-export-root]")) {
        closeAllExportMenus();
      }
    };

    var onDocumentKeyDown = function (event) {
      if (event.key === "Escape") {
        closeAllExportMenus();
      }
    };

    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    cleanupFns.push(function () {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    });

    if (typeof bindSidebarTreeEvents === "function") {
      bindSidebarTreeEvents(safeRoot, safeActions);
    }
    if (typeof bindViewerPanelEvents === "function") {
      bindViewerPanelEvents(safeRoot, safeActions);
    }

    disposeViewerViewBindings = function () {
      cleanupFns.forEach(function (cleanup) {
        try {
          cleanup();
        } catch (_error) {
          // ignore cleanup errors from detached nodes
        }
      });
      cleanupFns.length = 0;
    };
  }

  if (typeof validateViewerDomIds !== "undefined") {
    moduleState.validateViewerDomIds = validateViewerDomIds;
    global.validateViewerDomIds = validateViewerDomIds;
  }
  if (typeof clearViewerViewBindings !== "undefined") {
    moduleState.clearViewerViewBindings = clearViewerViewBindings;
    global.clearViewerViewBindings = clearViewerViewBindings;
  }
  if (typeof initViewerViewTemplate !== "undefined") {
    moduleState.initViewerViewTemplate = initViewerViewTemplate;
    global.initViewerViewTemplate = initViewerViewTemplate;
  }
  if (typeof renderViewerView !== "undefined") {
    moduleState.renderViewerView = renderViewerView;
    global.renderViewerView = renderViewerView;
  }
  if (typeof bindViewerViewEvents !== "undefined") {
    moduleState.bindViewerViewEvents = bindViewerViewEvents;
    global.bindViewerViewEvents = bindViewerViewEvents;
  }

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("views/viewerView");
  }
})(typeof window !== "undefined" ? window : globalThis);
