/**
 * API Client
 * Handles all HTTP requests with error handling
 */

import { buildUrl, DEFAULT_FETCH_OPTIONS } from './config.js';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make an API request
 */
export const apiRequest = async (endpoint, options = {}) => {
  try {
    const url = typeof endpoint === 'string' && endpoint.startsWith('http')
      ? endpoint
      : buildUrl(endpoint);

    const response = await fetch(url, {
      ...DEFAULT_FETCH_OPTIONS,
      ...options,
      headers: {
        ...DEFAULT_FETCH_OPTIONS.headers,
        ...options.headers,
      },
    });

    // Parse response
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle errors
    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || `HTTP ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or other errors
    throw new ApiError(
      error.message || 'Network error',
      0,
      null
    );
  }
};

/**
 * GET request
 */
export const get = (endpoint, params = {}) => {
  const url = buildUrl(endpoint, params);
  return apiRequest(url, { method: 'GET' });
};

/**
 * POST request
 */
export const post = (endpoint, body = null, params = {}) => {
  const url = buildUrl(endpoint, params);
  return apiRequest(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};
