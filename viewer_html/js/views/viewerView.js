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
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "views/viewerView";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("views/viewerView");
  }
})(typeof window !== "undefined" ? window : globalThis);
