(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/runtime/heatmapRuntime.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/runtime/heatmapRuntime.");
    return;
  }

  var moduleState = ensurePath(ns, "components.viewerPanel.runtime.heatmapRuntime");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "components/viewerPanel/runtime/heatmapRuntime";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/runtime/heatmapRuntime");
  }
})(typeof window !== "undefined" ? window : globalThis);
