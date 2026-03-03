(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel.");
    return;
  }

  var moduleState = ensurePath(ns, "components.viewerPanel");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "components/viewerPanel";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel");
  }
})(typeof window !== "undefined" ? window : globalThis);
