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
class LruCache {
  constructor(limit = 100) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }

    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);

    if (this.map.size > this.limit) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
  }

  clear() {
    this.map.clear();
  }
}
  if (typeof LruCache !== "undefined") {
    moduleState.LruCache = LruCache;
    global.LruCache = LruCache;
  }
  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("utils/lru");
  }
})(typeof window !== "undefined" ? window : globalThis);