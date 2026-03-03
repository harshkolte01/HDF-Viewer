(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for api/client.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading api/client.");
    return;
  }

  var moduleState = ensurePath(ns, "api.client");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "api/client";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("api/client");
  }
})(typeof window !== "undefined" ? window : globalThis);
