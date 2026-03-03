(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/store.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/store.");
    return;
  }

  var moduleState = ensurePath(ns, "state.store");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "state/store";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/store");
  }
})(typeof window !== "undefined" ? window : globalThis);
