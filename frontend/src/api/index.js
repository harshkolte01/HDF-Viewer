/**
 * API Module
 * Central export for all API services
 */

export { default as hdf5Service } from './hdf5Service';
export { ApiError } from './client';
export { default as API_BASE_URL, API_ENDPOINTS } from './config';

// Re-export individual methods for convenience
export {
    getFiles,
    refreshFiles,
    getFileChildren,
    getFileMeta,
    getFilePreview,
    getFileData,
    checkHealth,
    runBenchmark,
} from './hdf5Service';
