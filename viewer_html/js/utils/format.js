(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for utils/format.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading utils/format.");
    return;
  }

  var moduleState = ensurePath(ns, "utils.format");
  moduleState.__phase = "phase2-scaffold";
  moduleState.__moduleId = "utils/format";

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("utils/format");
  }
})(typeof window !== "undefined" ? window : globalThis);
