const DEFAULT_API_BASE_URL = "https://hdf-viewer-backend.vercel.app";

const runtimeConfig =
  typeof window !== "undefined" && window.__CONFIG__ ? window.__CONFIG__ : {};

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(runtimeConfig.API_BASE_URL);

export const API_ENDPOINTS = {
  FILES: "/files",
  FILES_REFRESH: "/files/refresh",
  FILE_CHILDREN: (key) => `/files/${encodeURIComponent(key)}/children`,
  FILE_META: (key) => `/files/${encodeURIComponent(key)}/meta`,
  FILE_PREVIEW: (key) => `/files/${encodeURIComponent(key)}/preview`,
  FILE_DATA: (key) => `/files/${encodeURIComponent(key)}/data`,
};

export const APP_CONFIG = Object.freeze({
  API_BASE_URL,
});

export function buildApiUrl(endpoint, params = {}) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(normalizedEndpoint, `${API_BASE_URL}/`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
}
