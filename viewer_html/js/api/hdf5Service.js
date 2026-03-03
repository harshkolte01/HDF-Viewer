(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for api/hdf5Service.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading api/hdf5Service.");
    return;
  }

  var moduleState = ensurePath(ns, "api.hdf5Service");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "api/hdf5Service";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("api/hdf5Service");
  }
})(typeof window !== "undefined" ? window : globalThis);
