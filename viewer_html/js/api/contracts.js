(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for api/contracts.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading api/contracts.");
    return;
  }

  var moduleState = ensurePath(ns, "api.contracts");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "api/contracts";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("api/contracts");
  }
})(typeof window !== "undefined" ? window : globalThis);
