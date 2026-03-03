(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for core/config.");
    return;
  }

  var DEFAULT_API_BASE_URL = "https://hdf-viewer-backend.vercel.app";

  var runtimeConfig =
    global.__CONFIG__ && typeof global.__CONFIG__ === "object" ? global.__CONFIG__ : {};

  function normalizeBaseUrl(value) {
    return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  }

  function encodeObjectKeyForPath(key) {
    return String(key || "")
      .split("/")
      .map(function (segment) {
        return encodeURIComponent(segment);
      })
      .join("/");
  }

  function appendSearchParams(searchParams, key, value) {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i += 1) {
        if (value[i] !== null && value[i] !== undefined) {
          searchParams.append(key, String(value[i]));
        }
      }
      return;
    }

    searchParams.append(key, String(value));
  }

  function buildApiUrl(endpoint, params) {
    var endpointValue = endpoint || "";
    var normalizedEndpoint =
      endpointValue.charAt(0) === "/" ? endpointValue : "/" + endpointValue;

    var url = new URL(normalizedEndpoint, API_BASE_URL + "/");
    var queryParams = params && typeof params === "object" ? params : {};

    Object.keys(queryParams).forEach(function (paramKey) {
      appendSearchParams(url.searchParams, paramKey, queryParams[paramKey]);
    });

    return url.toString();
  }

  var API_BASE_URL = normalizeBaseUrl(runtimeConfig.API_BASE_URL);

  var API_ENDPOINTS = Object.freeze({
    FILES: "/files",
    FILES_REFRESH: "/files/refresh",
    FILE_CHILDREN: function (key) {
      return "/files/" + encodeObjectKeyForPath(key) + "/children";
    },
    FILE_META: function (key) {
      return "/files/" + encodeObjectKeyForPath(key) + "/meta";
    },
    FILE_PREVIEW: function (key) {
      return "/files/" + encodeObjectKeyForPath(key) + "/preview";
    },
    FILE_DATA: function (key) {
      return "/files/" + encodeObjectKeyForPath(key) + "/data";
    },
    FILE_EXPORT_CSV: function (key) {
      return "/files/" + encodeObjectKeyForPath(key) + "/export/csv";
    },
  });

  var APP_CONFIG = Object.freeze({
    API_BASE_URL: API_BASE_URL,
  });

  var configApi = Object.freeze({
    DEFAULT_API_BASE_URL: DEFAULT_API_BASE_URL,
    runtimeConfig: runtimeConfig,
    API_BASE_URL: API_BASE_URL,
    API_ENDPOINTS: API_ENDPOINTS,
    APP_CONFIG: APP_CONFIG,
    normalizeBaseUrl: normalizeBaseUrl,
    encodeObjectKeyForPath: encodeObjectKeyForPath,
    buildApiUrl: buildApiUrl,
  });

  ns.core.config = configApi;
  ns.core.API_BASE_URL = API_BASE_URL;
  ns.core.API_ENDPOINTS = API_ENDPOINTS;
  ns.core.APP_CONFIG = APP_CONFIG;
  ns.core.normalizeBaseUrl = normalizeBaseUrl;
  ns.core.encodeObjectKeyForPath = encodeObjectKeyForPath;
  ns.core.buildApiUrl = buildApiUrl;

  ns.api = ns.api || {};
  ns.api.config = configApi;

  if (typeof ns.core.registerModule === "function") {
    ns.core.registerModule("core/config");
  }
})(typeof window !== "undefined" ? window : globalThis);
