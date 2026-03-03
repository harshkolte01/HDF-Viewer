(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for state/reducers.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading state/reducers.");
    return;
  }
  var moduleState = ensurePath(ns, "state");
  var utils =
    ns.state && ns.state.reducers && ns.state.reducers.utils
      ? ns.state.reducers.utils
      : null;
  if (!utils) {
    console.error("[HDFViewer] Missing dependency state/reducers/utils for state/reducers.");
    return;
  }
const actions = {};

const deps = {
  actions,
  getState,
  setState,
  api: {
    getFiles,
    refreshFiles,
    getFileChildren,
    getFileMeta,
    getFilePreview,
  },
  utils,
};

Object.assign(
  actions,
  createFileActions(deps),
  createTreeActions(deps),
  createViewActions(deps),
  createDisplayConfigActions(deps),
  createDataActions(deps),
  createCompareActions(deps)
);
  if (typeof actions !== "undefined") {
    moduleState.actions = actions;
    global.actions = actions;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("state/reducers");
  }
})(typeof window !== "undefined" ? window : globalThis);
