(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel/runtime.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel/runtime.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel.runtime");
var delegateBindViewerPanelEvents = global.bindViewerPanelEvents;
function bindViewerPanelEvents(root, actions) {
  if (typeof delegateBindViewerPanelEvents !== "function") {
    console.error("[HDFViewer] Missing bindViewerPanelEvents for components/viewerPanel/runtime.");
    return;
  }
  return delegateBindViewerPanelEvents(root, actions);
}
  if (typeof bindViewerPanelEvents !== "undefined") {
    moduleState.bindViewerPanelEvents = bindViewerPanelEvents;
    global.bindViewerPanelEvents = bindViewerPanelEvents;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel/runtime");
  }
})(typeof window !== "undefined" ? window : globalThis);
