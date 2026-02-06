/**
 * Simple Router for Page Navigation
 */

const APP_BASE_URL = new URL('../', import.meta.url);

function buildAppUrl(relativePath, query = {}) {
  const url = new URL(relativePath, APP_BASE_URL);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

/**
 * Navigate to home page
 */
export function navigateToHome() {
  window.location.href = buildAppUrl('index.html');
}

/**
 * Navigate to viewer page with file key
 */
export function navigateToViewer(fileKey) {
  try {
    if (fileKey) {
      window.sessionStorage.setItem('hdf_viewer_last_file_key', fileKey);
    }
  } catch (_) {
    // Ignore storage failures and continue navigation.
  }

  window.location.href = buildAppUrl('viewer/', { file: fileKey });
}

/**
 * Get query parameter by name
 */
export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Get all query parameters
 */
export function getAllQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Check if on viewer page
 */
export function isViewerPage() {
  const path = window.location.pathname;
  const viewerHtmlPath = new URL('viewer.html', APP_BASE_URL).pathname;
  const viewerDirPath = new URL('viewer/', APP_BASE_URL).pathname;
  const viewerDirNoSlash = viewerDirPath.endsWith('/') ? viewerDirPath.slice(0, -1) : viewerDirPath;
  return path === viewerHtmlPath || path === viewerDirPath || path === viewerDirNoSlash || path === `${viewerDirPath}index.html`;
}

/**
 * Check if on home page
 */
export function isHomePage() {
  const path = window.location.pathname;
  if (isViewerPage()) return false;
  const homePath = new URL('./', APP_BASE_URL).pathname;
  const homeIndexPath = new URL('index.html', APP_BASE_URL).pathname;
  return path === homePath || path === homeIndexPath;
}

export default {
  navigateToHome,
  navigateToViewer,
  getQueryParam,
  getAllQueryParams,
  isViewerPage,
  isHomePage,
};
