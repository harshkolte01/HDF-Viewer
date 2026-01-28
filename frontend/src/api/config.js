/**
 * API Configuration
 * Central configuration for all API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
    // Health check
    HEALTH: '/health',

    // File management
    FILES: '/files',
    FILES_REFRESH: '/files/refresh',

    // HDF5 navigation
    FILE_CHILDREN: (key) => `/files/${encodeURIComponent(key)}/children`,
    FILE_META: (key) => `/files/${encodeURIComponent(key)}/meta`,
    FILE_PREVIEW: (key) => `/files/${encodeURIComponent(key)}/preview`,

    // Benchmarking (optional)
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
