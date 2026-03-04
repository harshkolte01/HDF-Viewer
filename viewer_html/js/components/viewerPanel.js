// Viewer HTML module: Exposes stable viewer-panel facade functions that delegate to render and runtime bind implementations.
(function (global) {
  "use strict";
  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for components/viewerPanel.");
    return;
  }
  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading components/viewerPanel.");
    return;
  }
  var moduleState = ensurePath(ns, "components.viewerPanel");
var delegateRenderViewerPanel = global.renderViewerPanel;
var delegateBindViewerPanelEvents = global.bindViewerPanelEvents;
function renderViewerPanel(state) {
  if (typeof delegateRenderViewerPanel !== "function") {
    console.error("[HDFViewer] Missing renderViewerPanel for components/viewerPanel.");
    return "";
  }
  return delegateRenderViewerPanel(state);
}

function bindViewerPanelEvents(root, actions) {
  if (typeof delegateBindViewerPanelEvents !== "function") {
    console.error("[HDFViewer] Missing bindViewerPanelEvents for components/viewerPanel.");
    return;
  }
  return delegateBindViewerPanelEvents(root, actions);
}
  if (typeof renderViewerPanel !== "undefined") {
    moduleState.renderViewerPanel = renderViewerPanel;
    global.renderViewerPanel = renderViewerPanel;
  }
  if (typeof bindViewerPanelEvents !== "undefined") {
    moduleState.bindViewerPanelEvents = bindViewerPanelEvents;
    global.bindViewerPanelEvents = bindViewerPanelEvents;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("components/viewerPanel");
  }
})(typeof window !== "undefined" ? window : globalThis);

