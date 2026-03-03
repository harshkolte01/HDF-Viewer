(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for utils/lru.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading utils/lru.");
    return;
  }

  var moduleState = ensurePath(ns, "utils.lru");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "utils/lru";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("utils/lru");
  }
})(typeof window !== "undefined" ? window : globalThis);
