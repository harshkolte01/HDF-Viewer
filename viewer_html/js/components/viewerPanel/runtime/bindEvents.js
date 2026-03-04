// Viewer HTML module: Delegates panel interaction events and initializes per-shell matrix, line, and heatmap runtimes.
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

  var runtimeEventRoot = null;
  var runtimeActions = {};
  var disposeRuntimeEventBindings = null;

  function isMobileWidth() {
    return window.innerWidth <= 1024;
  }

  function clearRuntimePanelBindings() {
    if (typeof disposeRuntimeEventBindings === "function") {
      try {
        disposeRuntimeEventBindings();
      } catch (_error) {
        // ignore cleanup errors on detached roots
      }
    }
    disposeRuntimeEventBindings = null;
    runtimeEventRoot = null;
  }

  function bindRuntimeDelegatedEvents(root) {
    var onClick = function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      var sidebarToggle = target.closest("[data-sidebar-toggle]");
      if (sidebarToggle && root.contains(sidebarToggle)) {
        var sidebar = sidebarToggle.closest(".preview-sidebar");
        if (sidebar) {
          sidebar.classList.toggle("collapsed");
        }
        return;
      }

      var axisChange = target.closest("[data-axis-change]");
      if (axisChange && root.contains(axisChange)) {
        if (typeof runtimeActions.setDisplayAxis === "function") {
          var axis = axisChange.dataset.axisChange || "x";
          var dim = Number(axisChange.dataset.axisDim);
          runtimeActions.setDisplayAxis(axis, dim);
        }
        return;
      }

      var dimApply = target.closest("[data-dim-apply]");
      if (dimApply && root.contains(dimApply)) {
        if (typeof runtimeActions.applyDisplayConfig === "function") {
          runtimeActions.applyDisplayConfig();
        }
        return;
      }

      var dimReset = target.closest("[data-dim-reset]");
      if (dimReset && root.contains(dimReset)) {
        if (typeof runtimeActions.resetDisplayConfigFromPreview === "function") {
          runtimeActions.resetDisplayConfigFromPreview();
        }
        return;
      }

      var matrixEnable = target.closest("[data-matrix-enable]");
      if (matrixEnable && root.contains(matrixEnable)) {
        if (typeof runtimeActions.enableMatrixFullView === "function") {
          runtimeActions.enableMatrixFullView();
        }
        return;
      }

      var lineEnable = target.closest("[data-line-enable]");
      if (lineEnable && root.contains(lineEnable)) {
        if (isMobileWidth()) {
          root.querySelectorAll(".preview-sidebar").forEach(function (sidebar) {
            sidebar.classList.add("collapsed");
          });
        }
        if (typeof runtimeActions.enableLineFullView === "function") {
          runtimeActions.enableLineFullView();
        }
        return;
      }

      var compareToggle = target.closest("[data-line-compare-toggle]");
      if (compareToggle && root.contains(compareToggle)) {
        if (typeof runtimeActions.toggleLineCompare === "function") {
          runtimeActions.toggleLineCompare();
        }
        return;
      }

      var compareRemove = target.closest("[data-line-compare-remove]");
      if (compareRemove && root.contains(compareRemove)) {
        if (typeof runtimeActions.removeLineCompareDataset === "function") {
          runtimeActions.removeLineCompareDataset(compareRemove.dataset.lineCompareRemove || "/");
        }
        return;
      }

      var compareClear = target.closest("[data-line-compare-clear]");
      if (compareClear && root.contains(compareClear)) {
        if (typeof runtimeActions.clearLineCompare === "function") {
          runtimeActions.clearLineCompare();
        }
        return;
      }

      var compareDismiss = target.closest("[data-line-compare-dismiss]");
      if (compareDismiss && root.contains(compareDismiss)) {
        if (typeof runtimeActions.dismissLineCompareStatus === "function") {
          runtimeActions.dismissLineCompareStatus();
        }
        return;
      }

      var heatmapEnable = target.closest("[data-heatmap-enable]");
      if (heatmapEnable && root.contains(heatmapEnable)) {
        if (typeof runtimeActions.enableHeatmapFullView === "function") {
          runtimeActions.enableHeatmapFullView();
        }
      }
    };

    var onChange = function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      var dimSelect = target.closest("[data-display-dim-select]");
      if (dimSelect && root.contains(dimSelect)) {
        if (typeof runtimeActions.setDisplayDim === "function") {
          var index = Number(dimSelect.dataset.dimIndex);
          var dim = Number(dimSelect.value);
          runtimeActions.setDisplayDim(index, dim);
        }
        return;
      }

      var fixedNumber = target.closest("[data-fixed-index-number]");
      if (fixedNumber && root.contains(fixedNumber)) {
        if (typeof runtimeActions.stageFixedIndex === "function") {
          var numDim = Number(fixedNumber.dataset.fixedDim);
          var numSize = Number(fixedNumber.dataset.fixedSize);
          runtimeActions.stageFixedIndex(numDim, Number(fixedNumber.value), numSize);
        }
      }
    };

    var onInput = function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      var fixedRange = target.closest("[data-fixed-index-range]");
      if (fixedRange && root.contains(fixedRange)) {
        if (typeof runtimeActions.stageFixedIndex === "function") {
          var dim = Number(fixedRange.dataset.fixedDim);
          var size = Number(fixedRange.dataset.fixedSize);
          runtimeActions.stageFixedIndex(dim, Number(fixedRange.value), size);
        }
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", onInput);

    disposeRuntimeEventBindings = function disposeRuntimePanelEvents() {
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("input", onInput);
    };
  }

  function bindViewerPanelEvents(root, actions) {
    if (!root) {
      return;
    }

    runtimeActions = actions && typeof actions === "object" ? actions : {};

    if (runtimeEventRoot !== root || typeof disposeRuntimeEventBindings !== "function") {
      clearRuntimePanelBindings();
      runtimeEventRoot = root;
      bindRuntimeDelegatedEvents(root);
    }

    if (typeof clearViewerRuntimeBindings === "function") {
      clearViewerRuntimeBindings();
    }

    if (isMobileWidth()) {
      root.querySelectorAll(".preview-sidebar").forEach(function (sidebar) {
        sidebar.classList.add("collapsed");
      });
    }

    root.querySelectorAll("[data-matrix-shell]").forEach(function (shell) {
      if (typeof initializeMatrixRuntime === "function") {
        initializeMatrixRuntime(shell);
      }
    });

    root.querySelectorAll("[data-line-shell]").forEach(function (shell) {
      if (typeof initializeLineRuntime === "function") {
        initializeLineRuntime(shell);
      }
    });

    root.querySelectorAll("[data-heatmap-shell]").forEach(function (shell) {
      if (typeof initializeHeatmapRuntime === "function") {
        initializeHeatmapRuntime(shell);
      }
    });
  }

  if (typeof bindViewerPanelEvents !== "undefined") {
    moduleState.bindViewerPanelEvents = bindViewerPanelEvents;
    global.bindViewerPanelEvents = bindViewerPanelEvents;
  }
  if (typeof clearRuntimePanelBindings !== "undefined") {
    moduleState.clearRuntimePanelBindings = clearRuntimePanelBindings;
    global.clearRuntimePanelBindings = clearRuntimePanelBindings;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/runtime/bindEvents");
  }
})(typeof window !== "undefined" ? window : globalThis);

