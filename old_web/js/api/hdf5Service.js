/**
 * HDF5 API Service
 * Handles all HDF5-related API calls - matches React version exactly
 */

import { get, post } from './client.js';
import { API_ENDPOINTS } from './config.js';

/**
 * Get list of all HDF5 files
 */
export const getFiles = async () => {
  return await get(API_ENDPOINTS.FILES);
};

/**
 * Refresh files cache
 */
export const refreshFiles = async () => {
  return await post(API_ENDPOINTS.FILES_REFRESH);
};

/**
 * Get children of a specific path in an HDF5 file
 */
export const getFileChildren = async (key, path = '/') => {
  const endpoint = API_ENDPOINTS.FILE_CHILDREN(key);
  return await get(endpoint, { path });
};

/**
 * Get metadata for a specific path in an HDF5 file
 */
export const getFileMeta = async (key, path) => {
  const endpoint = API_ENDPOINTS.FILE_META(key);
  return await get(endpoint, { path });
};

/**
 * Get preview payload for a specific dataset path
 */
export const getFilePreview = async (key, path, params = {}) => {
  const endpoint = API_ENDPOINTS.FILE_PREVIEW(key);
  return await get(endpoint, { path, ...params });
};

/**
 * Get full data payload for a specific dataset path
 */
export const getFileData = async (key, path, params = {}) => {
  const endpoint = API_ENDPOINTS.FILE_DATA(key);
  return await get(endpoint, { path, ...params });
};

/**
 * Check server health
 */
export const checkHealth = async () => {
  return await get(API_ENDPOINTS.HEALTH);
};

export default {
  getFiles,
  refreshFiles,
  getFileChildren,
  getFileMeta,
  getFilePreview,
  getFileData,
  checkHealth,
};
