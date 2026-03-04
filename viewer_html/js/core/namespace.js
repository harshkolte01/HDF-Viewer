// Viewer HTML module: Initializes the global HDFViewer namespace, module registry, and dependency guards for plain-script loading.
(function (global) {
  "use strict";

  if (!global) {
    return;
  }

  var existingNamespace = global.HDFViewer;
  if (existingNamespace && typeof existingNamespace !== "object") {
    console.error("[HDFViewer] Cannot initialize namespace: window.HDFViewer is not an object.");
    return;
  }

  var ns = existingNamespace || {};

  function ensureObject(target, key) {
    if (!target[key] || typeof target[key] !== "object") {
      target[key] = {};
    }
    return target[key];
  }

  function ensurePath(root, path) {
    if (!path) {
      return root;
    }

    var parts = String(path).split(".");
    var cursor = root;

    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i];
      if (!part) {
        continue;
      }

      if (!cursor[part] || typeof cursor[part] !== "object") {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }

    return cursor;
  }

  ns.__initialized = true;
  ns.__phase = "phase3-port";

  ensureObject(ns, "core");
  ensureObject(ns, "utils");
  ensureObject(ns, "api");
  ensureObject(ns, "state");
  ensureObject(ns, "components");
  ensureObject(ns, "views");
  ensureObject(ns, "app");

  ns.core.ensurePath = ensurePath;
  ns.core.loadedModules = ns.core.loadedModules || {};
  ns.core.registerModule = function registerModule(moduleId) {
    if (!moduleId) {
      return;
    }
    ns.core.loadedModules[moduleId] = true;
  };
  ns.core.requireModules = function requireModules(moduleIds, scope) {
    var ids = Array.isArray(moduleIds) ? moduleIds : [];
    var missing = [];

    for (var i = 0; i < ids.length; i += 1) {
      var id = ids[i];
      if (id && !ns.core.loadedModules[id]) {
        missing.push(id);
      }
    }

    if (missing.length > 0) {
      console.error(
        "[HDFViewer] Missing required modules" + (scope ? " for " + scope : "") + ":",
        missing.join(", ")
      );
    }

    return {
      ok: missing.length === 0,
      missing: missing,
    };
  };

  ns.core.registerModule("core/namespace");

  global.HDFViewer = ns;
})(typeof window !== "undefined" ? window : globalThis);

