/**
 * API Configuration
 * Central configuration for all API calls
 */

const API_BASE_URL = 'https://hdf-viewer-backend.vercel.app';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  HEALTH: '/health',
  FILES: '/files',
  FILES_REFRESH: '/files/refresh',
  FILE_CHILDREN: (key) => `/files/${encodeURIComponent(key)}/children`,
  FILE_META: (key) => `/files/${encodeURIComponent(key)}/meta`,
  FILE_PREVIEW: (key) => `/files/${encodeURIComponent(key)}/preview`,
  FILE_DATA: (key) => `/files/${encodeURIComponent(key)}/data`,
  BENCHMARK: '/benchmark',
};

/**
 * Build full URL for an endpoint
 */
export const buildUrl = (endpoint, params = {}) => {
  const url = new URL(endpoint, API_BASE_URL);

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value);
    }
  });

  return url.toString();
};

/**
 * Default fetch options
 */
export const DEFAULT_FETCH_OPTIONS = {
  headers: {
    'Content-Type': 'application/json',
  },
};

export default API_BASE_URL;
