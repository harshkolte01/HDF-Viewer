(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/reducers/utils.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/reducers/utils.");
    return;
  }

  var moduleState = ensurePath(ns, "state.reducers.utils");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "state/reducers/utils";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/reducers/utils");
  }
})(typeof window !== "undefined" ? window : globalThis);
