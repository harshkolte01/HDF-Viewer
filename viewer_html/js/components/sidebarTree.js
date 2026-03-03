(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/sidebarTree.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/sidebarTree.");
    return;
  }

  var moduleState = ensurePath(ns, "components.sidebarTree");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "components/sidebarTree";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/sidebarTree");
  }
})(typeof window !== "undefined" ? window : globalThis);
