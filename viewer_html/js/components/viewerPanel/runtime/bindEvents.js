(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/runtime/bindEvents.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/runtime/bindEvents.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel.runtime.bindEvents");
function isMobileWidth() {
  return window.innerWidth <= 1024;
}
function bindViewerPanelEvents(root, actions) {
  clearViewerRuntimeBindings();

  /* â”€â”€ Sidebar collapse toggle (mobile) â”€â”€ */
  root.querySelectorAll("[data-sidebar-toggle]").forEach((btn) => {
    const sidebar = btn.closest(".preview-sidebar");
    if (!sidebar) return;
    /* auto-collapse on mobile */
    if (isMobileWidth()) {
      sidebar.classList.add("collapsed");
    }
    btn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
    });
  });

  root.querySelectorAll("[data-axis-change]").forEach((button) => {
    button.addEventListener("click", () => {
      const axis = button.dataset.axisChange || "x";
      const dim = Number(button.dataset.axisDim);
      actions.setDisplayAxis(axis, dim);
    });
  });

  root.querySelectorAll("[data-display-dim-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.dimIndex);
      const dim = Number(select.value);
      actions.setDisplayDim(index, dim);
    });
  });

  root.querySelectorAll("[data-fixed-index-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-fixed-index-number]").forEach((input) => {
    input.addEventListener("change", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-dim-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.applyDisplayConfig();
    });
  });

  root.querySelectorAll("[data-dim-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.resetDisplayConfigFromPreview();
    });
  });

  root.querySelectorAll("[data-matrix-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableMatrixFullView();
    });
  });

  root.querySelectorAll("[data-line-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      /* auto-collapse dimension sidebar on mobile when loading full chart */
      if (isMobileWidth()) {
        root.querySelectorAll(".preview-sidebar").forEach((sb) => {
          sb.classList.add("collapsed");
        });
      }
      actions.enableLineFullView();
    });
  });

  root.querySelectorAll("[data-line-compare-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.toggleLineCompare();
    });
  });

  root.querySelectorAll("[data-line-compare-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.removeLineCompareDataset(button.dataset.lineCompareRemove || "/");
    });
  });

  root.querySelectorAll("[data-line-compare-clear]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.clearLineCompare();
    });
  });

  root.querySelectorAll("[data-line-compare-dismiss]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.dismissLineCompareStatus();
    });
  });

  root.querySelectorAll("[data-heatmap-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableHeatmapFullView();
    });
  });

  root.querySelectorAll("[data-matrix-shell]").forEach((shell) => {
    initializeMatrixRuntime(shell);
  });

  root.querySelectorAll("[data-line-shell]").forEach((shell) => {
    initializeLineRuntime(shell);
  });

  root.querySelectorAll("[data-heatmap-shell]").forEach((shell) => {
    initializeHeatmapRuntime(shell);
  });
}
  if (typeof bindViewerPanelEvents !== "undefined") {
    moduleState.bindViewerPanelEvents = bindViewerPanelEvents;
    global.bindViewerPanelEvents = bindViewerPanelEvents;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/runtime/bindEvents");
  }
})(typeof window !== "undefined" ? window : globalThis);