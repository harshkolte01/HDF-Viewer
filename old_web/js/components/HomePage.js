/**
 * HomePage Component
 * Displays file list with search and refresh
 */

import { Component } from './Component.js';
import { getFiles, refreshFiles } from '../api/hdf5Service.js';
import { formatBytes } from '../utils/formatters.js';
import { navigateToViewer } from '../router.js';
import { debounce } from '../utils/debounce.js';

export class HomePage extends Component {
  constructor(container) {
    super(container);
    
    this.state = {
      files: [],
      loading: true,
      error: null,
      refreshing: false,
      searchQuery: '',
    };
    
    this.handleRefreshBound = this.handleRefresh.bind(this);
    this.handleSearchBound = debounce(this.handleSearch.bind(this), 300);
    
    this.init();
  }

  async init() {
    await this.fetchFiles();
    this.setupEventListeners();
  }

  async fetchFiles() {
    try {
      this.setState({ loading: true, error: null });
      const response = await getFiles();
      this.setState({
        files: response.files || [],
        loading: false,
      });
    } catch (error) {
      this.setState({
        error: error.message,
        loading: false,
      });
    }
  }

  async handleRefresh() {
    try {
      this.setState({ refreshing: true });
      await refreshFiles();
      await this.fetchFiles();
      this.setState({ refreshing: false });
    } catch (error) {
      this.setState({
        error: error.message,
        refreshing: false,
      });
    }
  }

  handleSearch(event) {
    const query = event.target.value.toLowerCase();
    this.setState({ searchQuery: query });
  }

  handleOpenFile(fileKey) {
    navigateToViewer(fileKey);
  }

  getFilteredFiles() {
    const { files, searchQuery } = this.state;
    if (!searchQuery) return files;
    return files.filter(file => 
      file.key.toLowerCase().includes(searchQuery)
    );
  }

  setupEventListeners() {
    // Refresh button
    this.on('click', '.refresh-btn', this.handleRefreshBound);
    
    // Search input
    this.on('input', '.search-input', this.handleSearchBound);
    
    // Open file buttons
    this.on('click', '.go-btn', (e, target) => {
      const fileKey = target.dataset.fileKey;
      this.handleOpenFile(fileKey);
    });
  }

  renderStats() {
    const files = this.getFilteredFiles();
    const totalFiles = this.state.files.length;
    const totalSize = this.state.files.reduce((sum, f) => sum + (f.size || 0), 0);
    const filteredCount = files.length;

    return `
      <div class="stats-bar">
        <div class="stat-card">
          <div class="stat-label">Total Files</div>
          <div class="stat-value">${totalFiles}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Size</div>
          <div class="stat-value">${formatBytes(totalSize)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Filtered Results</div>
          <div class="stat-value">${filteredCount}</div>
        </div>
      </div>
    `;
  }

  renderControls() {
    const { refreshing } = this.state;
    return `
      <div class="controls-bar">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="2"/>
            <path d="M11 11L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            placeholder="Search files..."
            value="${this.state.searchQuery}"
          />
        </div>
        <button class="refresh-btn" ${refreshing ? 'disabled' : ''}>
          ${refreshing ? '<span class="spinner"></span>' : ''}
          ${refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    `;
  }

  renderTable() {
    const files = this.getFilteredFiles();

    if (files.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <div class="empty-title">No files found</div>
          <div class="empty-description">
            ${this.state.searchQuery ? 'Try a different search query' : 'No HDF5 files available'}
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="table-container">
          <table class="files-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>File Name</th>
                <th>File Size</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${files.map((file, index) => `
                <tr>
                  <td class="sr-no">${index + 1}</td>
                  <td class="file-name">${file.key}</td>
                  <td class="file-size">${formatBytes(file.size || 0)}</td>
                  <td class="action-cell">
                    <button class="go-btn" data-file-key="${file.key}">Open</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  render() {
    const { loading, error } = this.state;

    this.container.innerHTML = `
      <div class="app">
        <nav class="navbar">
          <div class="navbar-content">
            <div class="navbar-brand">
              <div class="navbar-logo">H5</div>
              <h1 class="navbar-title">HDF5 Viewer</h1>
            </div>
          </div>
        </nav>

        <main class="main-content">
          <div class="container">
            <div class="page-header">
              <h2 class="page-title">Browse HDF5 Files</h2>
              <p class="page-subtitle">Select a file to explore its contents</p>
            </div>

            ${error ? `
              <div class="error-state">
                <div class="error-title">Error</div>
                <div class="error-message">${error}</div>
              </div>
            ` : ''}

            ${loading ? `
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading files...</div>
              </div>
            ` : `
              ${this.renderStats()}
              ${this.renderControls()}
              ${this.renderTable()}
            `}
          </div>
        </main>
      </div>
    `;
  }
}

export default HomePage;
