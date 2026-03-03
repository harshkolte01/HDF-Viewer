(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for app-viewer.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading app-viewer.");
    return;
  }

  var moduleState = ensurePath(ns, "app.viewerBoot");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "app-viewer";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("app-viewer");
  }
})(typeof window !== "undefined" ? window : globalThis);
