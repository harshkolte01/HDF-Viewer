/**
 * HDF5 API Service
 * Handles all HDF5-related API calls
 */

import { get, post } from './client';
import { API_ENDPOINTS } from './config';

/**
 * Get list of all HDF5 files
 * @returns {Promise<{success: boolean, count: number, files: Array, cached: boolean}>}
 */
export const getFiles = async () => {
    return await get(API_ENDPOINTS.FILES);
};

/**
 * Refresh files cache
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const refreshFiles = async () => {
    return await post(API_ENDPOINTS.FILES_REFRESH);
};

/**
 * Get children of a specific path in an HDF5 file
 * @param {string} key - File key/name
 * @param {string} path - HDF5 internal path (default: '/')
 * @returns {Promise<{success: boolean, key: string, path: string, children: Array, cached: boolean}>}
 */
export const getFileChildren = async (key, path = '/') => {
    const endpoint = API_ENDPOINTS.FILE_CHILDREN(key);
    return await get(endpoint, { path });
};

/**
 * Get metadata for a specific path in an HDF5 file
 * @param {string} key - File key/name
 * @param {string} path - HDF5 internal path
 * @returns {Promise<{success: boolean, key: string, metadata: object, cached: boolean}>}
 */
export const getFileMeta = async (key, path) => {
    const endpoint = API_ENDPOINTS.FILE_META(key);
    return await get(endpoint, { path });
};

/**
 * Get preview payload for a specific dataset path
 * @param {string} key - File key/name
 * @param {string} path - HDF5 internal path
 * @param {object} params - Optional preview parameters
 * @returns {Promise<object>}
 */
export const getFilePreview = async (key, path, params = {}) => {
    const endpoint = API_ENDPOINTS.FILE_PREVIEW(key);
    return await get(endpoint, { path, ...params });
};

/**
 * Check server health
 * @returns {Promise<{status: string, timestamp: string, service: string}>}
 */
export const checkHealth = async () => {
    return await get(API_ENDPOINTS.HEALTH);
};

/**
 * Run performance benchmark
 * @returns {Promise<object>}
 */
export const runBenchmark = async () => {
    return await get(API_ENDPOINTS.BENCHMARK);
};

export default {
    getFiles,
    refreshFiles,
    getFileChildren,
    getFileMeta,
    getFilePreview,
    checkHealth,
    runBenchmark,
};
