import { formatBytes, escapeHtml } from "../utils/format.js";
import { renderFilesTable } from "../components/tableView.js";

function getFilteredFiles(state) {
  const query = state.searchQuery.toLowerCase();
  return state.files.filter((file) =>
    String(file.key || "")
      .toLowerCase()
      .includes(query)
  );
}

function getTotalSize(state) {
  const total = state.files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  return formatBytes(total);
}

function renderStats(state, filteredFiles) {
  if (state.loading || state.error) {
    return "";
  }

  return `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">Total Files</div>
        <div class="stat-value">${state.files.length}<span class="stat-unit">files</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Size</div>
        <div class="stat-value">${getTotalSize(state)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Showing</div>
        <div class="stat-value">${filteredFiles.length}<span class="stat-unit">of ${state.files.length}</span></div>
      </div>
    </div>
  `;
}

function renderControls(state) {
  if (state.loading || state.error || state.files.length === 0) {
    return "";
  }

  return `
    <div class="controls-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input id="search-input" type="text" class="search-input" placeholder="Search files..." value="${escapeHtml(state.searchQuery)}" />
      </div>
    </div>
  `;
}

function renderFileListSection(state, filteredFiles) {
  if (state.loading) {
    return `
      <div class="card">
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p class="loading-text">Loading files...</p>
        </div>
      </div>
    `;
  }

  if (state.error) {
    return `
      <div class="error-state">
        <div class="error-title">Error Loading Files</div>
        <div class="error-message">${escapeHtml(state.error)}</div>
        <button id="retry-btn" class="refresh-btn" type="button">Try Again</button>
      </div>
    `;
  }

  if (state.files.length === 0) {
    return `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">H5</div>
          <div class="empty-title">No files found</div>
          <div class="empty-description">Upload HDF5 files to your MinIO bucket to get started</div>
        </div>
      </div>
    `;
  }

  if (filteredFiles.length === 0) {
    return `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">H5</div>
          <div class="empty-title">No matching files</div>
          <div class="empty-description">Try adjusting your search query</div>
        </div>
      </div>
    `;
  }

  return renderFilesTable(filteredFiles);
}

export function renderHomeView(state) {
  const filteredFiles = getFilteredFiles(state);

  return `
    <div class="page-header">
      <h1 class="page-title">Files</h1>
      <p class="page-subtitle">Browse and open your HDF5 files</p>
    </div>
    ${renderStats(state, filteredFiles)}
    ${renderControls(state)}
    ${renderFileListSection(state, filteredFiles)}
  `;
}

export function bindHomeViewEvents(root, actions) {
  const retryButton = root.querySelector("#retry-btn");
  if (retryButton) {
    retryButton.addEventListener("click", actions.loadFiles);
  }

  const searchInput = root.querySelector("#search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      actions.setSearchQuery(event.target.value);
    });
  }

  root.querySelectorAll("[data-open-file]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.openViewer({
        key: button.dataset.openFile || "",
        etag: button.dataset.openEtag || null,
      });
    });
  });
}
