import { useEffect, useState } from 'react';
import { getFiles, refreshFiles } from '../api';
import '../App.css';

function HomePage({ onOpenFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFiles();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message || 'Failed to load files');
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      await refreshFiles();
      await fetchFiles();
    } catch (err) {
      setError(err.message || 'Failed to refresh files');
      console.error('Error refreshing files:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenFile = (fileKey) => {
    if (onOpenFile) {
      onOpenFile(fileKey);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getTotalSize = () => {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    return formatFileSize(total);
  };

  const filteredFiles = files.filter((file) =>
    file.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">
            <div className="navbar-logo">H</div>
            <span className="navbar-title">HDF Viewer</span>
          </div>
          <div className="navbar-actions">
            <button
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <>
                  <span className="spinner"></span>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="container">
          <div className="page-header">
            <h1 className="page-title">Files</h1>
            <p className="page-subtitle">Browse and open your HDF5 files</p>
          </div>

          {!loading && !error && (
            <div className="stats-bar">
              <div className="stat-card">
                <div className="stat-label">Total Files</div>
                <div className="stat-value">
                  {files.length}
                  <span className="stat-unit">files</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Size</div>
                <div className="stat-value">{getTotalSize()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Showing</div>
                <div className="stat-value">
                  {filteredFiles.length}
                  <span className="stat-unit">of {files.length}</span>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <div className="controls-bar">
              <div className="search-box">
                <svg
                  className="search-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}

          {loading && (
            <div className="card">
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading files...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="error-state">
              <div className="error-title">Error Loading Files</div>
              <div className="error-message">{error}</div>
              <button className="refresh-btn" onClick={fetchFiles}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">H5</div>
                <div className="empty-title">No files found</div>
                <div className="empty-description">
                  Upload HDF5 files to your MinIO bucket to get started
                </div>
              </div>
            </div>
          )}

          {!loading && !error && files.length > 0 && filteredFiles.length === 0 && (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">H5</div>
                <div className="empty-title">No matching files</div>
                <div className="empty-description">Try adjusting your search query</div>
              </div>
            </div>
          )}

          {!loading && !error && filteredFiles.length > 0 && (
            <div className="card">
              <div className="table-container">
                <table className="files-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>File Name</th>
                      <th>File Size</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file, index) => (
                      <tr key={file.key}>
                        <td className="sr-no">{index + 1}</td>
                        <td className="file-name">{file.key}</td>
                        <td className="file-size">{formatFileSize(file.size)}</td>
                        <td className="action-cell">
                          <button
                            className="go-btn"
                            onClick={() => handleOpenFile(file.key)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default HomePage;
