(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/reducers/viewActions.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/reducers/viewActions.");
    return;
  }

  var moduleState = ensurePath(ns, "state.reducers.viewActions");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "state/reducers/viewActions";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/reducers/viewActions");
  }
})(typeof window !== "undefined" ? window : globalThis);
