// Viewer HTML module: Provides shared HTML escaping and byte formatting helpers used by renderers.
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
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function formatBytes(bytes) {
  const safeBytes = Number(bytes) || 0;
  if (safeBytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.floor(Math.log(safeBytes) / Math.log(1024));
  const normalizedIndex = Math.min(unitIndex, units.length - 1);

  return `${(safeBytes / 1024 ** normalizedIndex).toFixed(2)} ${units[normalizedIndex]}`;
}
  if (typeof escapeHtml !== "undefined") {
    moduleState.escapeHtml = escapeHtml;
    global.escapeHtml = escapeHtml;
  }
  if (typeof formatBytes !== "undefined") {
    moduleState.formatBytes = formatBytes;
    global.formatBytes = formatBytes;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("utils/format");
  }
})(typeof window !== "undefined" ? window : globalThis);
