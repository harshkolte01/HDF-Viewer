(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/reducers/dataActions.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/reducers/dataActions.");
    return;
  }

  var moduleState = ensurePath(ns, "state.reducers.dataActions");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "state/reducers/dataActions";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/reducers/dataActions");
  }
})(typeof window !== "undefined" ? window : globalThis);
