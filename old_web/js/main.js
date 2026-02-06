/**
 * Main Entry Point
 * Initializes the application based on current page
 */

import { HomePage } from './components/HomePage.js';
import ViewerPage from './components/ViewerPage.js';
import { isHomePage, isViewerPage, getQueryParam } from './router.js';
const HOME_URL = new URL('../index.html', import.meta.url).toString();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');

  if (!root) {
    console.error('Root element not found');
    return;
  }

  try {
    // Check viewer first so /viewer/ is not treated as home (it ends with '/').
    if (isViewerPage()) {
      const queryFileKey = getQueryParam('file') || getQueryParam('key');
      let storedFileKey = null;
      try {
        storedFileKey = window.sessionStorage.getItem('hdf_viewer_last_file_key');
      } catch (_) {
        storedFileKey = null;
      }

      const fileKey = queryFileKey || storedFileKey;
      if (fileKey) {
        // Normalize URL so refresh/share keeps the active file.
        if (!queryFileKey) {
          const url = new URL(window.location.href);
          url.searchParams.set('file', fileKey);
          window.history.replaceState(null, '', url.toString());
        }

        new ViewerPage(root, { fileKey });
      } else {
        root.innerHTML = `
          <div class="app">
            <div style="padding: 2rem; text-align: center;">
              <h1>No file specified</h1>
              <p>Open a file from home first, or use <code>?file=&lt;filename.h5&gt;</code>.</p>
              <p><a href="${HOME_URL}" style="color: var(--primary)">Back to Home</a></p>
            </div>
          </div>
        `;
      }
    } else if (isHomePage()) {
      new HomePage(root);
    } else {
      root.innerHTML = `
        <div class="app">
          <div style="padding: 2rem; text-align: center;">
            <h1>Page not found</h1>
            <p><a href="${HOME_URL}" style="color: var(--primary)">Go to Home</a></p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Application initialization error:', error);
    root.innerHTML = `
      <div class="app">
        <div style="padding: 2rem; text-align: center; color: var(--error);">
          <h1>Error</h1>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }
});
