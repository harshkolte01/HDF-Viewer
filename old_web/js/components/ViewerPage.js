import Component from './Component.js';
import SidebarTree from './viewer/SidebarTree.js';
import TopBar from './viewer/TopBar.js';
import PreviewToolbar from './viewer/PreviewToolbar.js';
import ViewerPanel from './viewer/ViewerPanel.js';
import { getFileMeta, getFilePreview, getFileData } from '../api/hdf5Service.js';
import { navigateToHome } from '../router.js';
import { $ } from '../utils/dom.js';

// Constants
const MATRIX_BLOCK_ROWS = 200;
const MATRIX_BLOCK_COLS = 50;
const HEATMAP_MAX_SIZE = 1024;

/**
 * Normalizes fixed indices object to ensure numeric keys and values
 */
function normalizeFixedIndices(indices) {
  if (!indices) return {};
  return Object.entries(indices).reduce((acc, [key, value]) => {
    const dim = Number(key);
    const idx = Number(value);
    if (Number.isFinite(dim) && Number.isFinite(idx)) {
      acc[dim] = idx;
    }
    return acc;
  }, {});
}

/**
 * Builds query parameter string for fixed indices
 * Format: "0=5,2=10" for {0: 5, 2: 10}
 */
function buildFixedIndicesParam(indices) {
  const entries = Object.entries(indices || {})
    .filter(([key, value]) => Number.isFinite(Number(key)) && Number.isFinite(Number(value)))
    .sort(([a], [b]) => Number(a) - Number(b));
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key}=${value}`).join(',');
}

/**
 * Builds next fixed indices when display dimensions change
 * Removes indices for selected dimensions, keeps/clamps others
 */
function buildNextFixedIndices(currentIndices, nextDims, shape) {
  const next = { ...(currentIndices || {}) };
  
  // Remove indices for dimensions that will be displayed
  nextDims.forEach((dim) => {
    delete next[dim];
  });

  // Add/update indices for non-displayed dimensions
  (shape || []).forEach((size, dim) => {
    if (nextDims.includes(dim)) return;
    const max = Math.max(0, size - 1);
    const fallback = Math.floor(size / 2);
    if (!Number.isFinite(next[dim])) {
      next[dim] = fallback;
    } else {
      next[dim] = Math.max(0, Math.min(max, next[dim]));
    }
  });

  return next;
}

export default class ViewerPage extends Component {
  constructor(container, { fileKey }) {
    super(container);
    this.fileKey = fileKey;
    
    this.state = {
      // Navigation
      selectedPath: '/',
      viewMode: 'display', // 'display' | 'inspect'
      
      // Metadata (inspect mode)
      meta: null,
      metaLoading: false,
      metaError: null,
      
      // Preview data (display mode)
      preview: null,
      previewLoading: false,
      previewError: null,
      
      // Display configuration
      displayTab: 'table', // 'table' | 'line' | 'heatmap'
      displayDims: null, // [rowDim, colDim]
      fixedIndices: {}, // {dim: index}
      
      // Staging state for dimension controls
      stagedDisplayDims: null,
      stagedFixedIndices: {},
      
      // Display controls
      notation: 'auto',
      lineGrid: true,
      lineAspect: 'line',
      heatmapGrid: true,
      heatmapColormap: 'viridis',
      
      // Matrix state (table tab with full data)
      matrixEnabled: false,
      matrixLoading: false,
      matrixError: null,
      matrixVersion: 0,
      
      // Heatmap state
      heatmapEnabled: false,
      heatmapLoading: false,
      heatmapError: null,
      heatmapData: null,
      
      // Line chart state
      lineEnabled: false,
      lineLoading: false,
      lineError: null,
      lineData: null
    };
    
    // Refs (non-reactive data)
    this.matrixCache = new Map();
    this.matrixPending = new Set();
    this.heatmapKey = '';
    this.lineKey = '';
    this.lineTimer = null;
    
    // Child components
    this.sidebarTree = null;
    this.topBar = null;
    this.previewToolbar = null;
    this.viewerPanel = null;

    // Initial render + initial data load
    this.render();
    this.onMount();
  }

  /**
   * Override setState to enable update effects for this orchestrator component.
   * Supports an optional options bag: { skipEffects: boolean }.
   */
  setState(updates, options = {}) {
    const prevState = { ...this.state };
    super.setState(updates);
    if (!options.skipEffects) {
      this.onUpdate(prevState);
    }
  }

  /**
   * Computes derived values from state
   */
  getComputedState() {
    const { preview, displayDims, fixedIndices, selectedPath } = this.state;
    
    // Check if heatmap tab should be available
    const showHeatmap = preview?.ndim >= 2;
    
    // Build display dimensions key
    const displayDimsKey = Array.isArray(displayDims) && displayDims.length === 2
      ? displayDims.join(',')
      : '';
    
    // Build fixed indices key
    const fixedIndicesKey = buildFixedIndicesParam(fixedIndices) || '';
    
    // Build unique selection key for cache invalidation
    const selectionKey = [this.fileKey, selectedPath, displayDimsKey, fixedIndicesKey].join('|');
    
    // Compute matrix shape if applicable
    let matrixShape = null;
    if (preview?.shape && Array.isArray(displayDims) && displayDims.length === 2) {
      const rows = preview.shape[displayDims[0]];
      const cols = preview.shape[displayDims[1]];
      if (Number.isFinite(rows) && Number.isFinite(cols)) {
        matrixShape = { rows, cols };
      }
    }
    
    return {
      showHeatmap,
      displayDimsKey,
      fixedIndicesKey,
      selectionKey,
      matrixShape
    };
  }

  /**
   * Reset all data state (matrix, heatmap, line)
   */
  resetDataState() {
    this.matrixCache.clear();
    this.matrixPending.clear();
    this.heatmapKey = '';
    this.lineKey = '';
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
      this.lineTimer = null;
    }
    
    this.setState({
      matrixEnabled: false,
      matrixLoading: false,
      matrixError: null,
      matrixVersion: 0,
      heatmapEnabled: false,
      heatmapLoading: false,
      heatmapError: null,
      heatmapData: null,
      lineEnabled: false,
      lineLoading: false,
      lineError: null,
      lineData: null
    });
  }

  /**
   * Fetch metadata for selected path (inspect mode only)
   */
  async fetchMeta() {
    const { selectedPath, viewMode } = this.state;
    
    if (!this.fileKey || !selectedPath || viewMode !== 'inspect' || selectedPath === '/') {
      this.setState({
        meta: null,
        metaError: null,
        metaLoading: false
      });
      return;
    }
    
    try {
      this.setState({ metaLoading: true, metaError: null });
      const data = await getFileMeta(this.fileKey, selectedPath);
      this.setState({ meta: data.metadata || null });
    } catch (err) {
      this.setState({
        metaError: err.message || 'Failed to load metadata',
        meta: null
      });
    } finally {
      this.setState({ metaLoading: false });
    }
  }

  /**
   * Fetch preview data for selected path (display mode only)
   */
  async fetchPreview() {
    const { selectedPath, viewMode, displayDims, fixedIndices } = this.state;
    const { displayDimsKey, fixedIndicesKey } = this.getComputedState();
    
    if (!this.fileKey || !selectedPath || viewMode !== 'display' || selectedPath === '/') {
      this.setState({
        preview: null,
        previewError: null,
        previewLoading: false
      });
      return;
    }
    
    const params = {
      mode: 'auto',
      max_size: 512
    };
    
    if (displayDimsKey) {
      params.display_dims = displayDimsKey;
    }
    
    if (fixedIndicesKey) {
      params.fixed_indices = fixedIndicesKey;
    }
    
    try {
      this.setState({ previewLoading: true, previewError: null });
      const data = await getFilePreview(this.fileKey, selectedPath, params);
      this.setState({ preview: data || null });
      
      // Initialize/sync dimension state
      const newDims = Array.isArray(displayDims) && displayDims.length === 2
        ? displayDims
        : Array.isArray(data?.display_dims) ? data.display_dims : [0, 1];
      
      let newIndices = fixedIndices;
      if (Object.keys(fixedIndices).length === 0 && data?.fixed_indices) {
        const normalized = normalizeFixedIndices(data.fixed_indices);
        if (Object.keys(normalized).length > 0) {
          newIndices = normalized;
        }
      }
      
      this.setState({
        displayDims: newDims,
        stagedDisplayDims: newDims,
        fixedIndices: newIndices,
        stagedFixedIndices: newIndices
      });
      
      // Switch from heatmap tab if data becomes 1D
      if (data && this.state.displayTab === 'heatmap' && data.ndim < 2) {
        this.setState({ displayTab: 'table' });
      }
    } catch (err) {
      this.setState({
        previewError: err.message || 'Failed to load preview',
        preview: null
      });
    } finally {
      this.setState({ previewLoading: false });
    }
  }

  /**
   * Build cache key for matrix block
   */
  buildMatrixCacheKey(rowOffset, colOffset, rowLimit, colLimit) {
    const { selectionKey } = this.getComputedState();
    if (!selectionKey) return '';
    return `${selectionKey}|r${rowOffset}|c${colOffset}|rl${rowLimit}|cl${colLimit}`;
  }

  /**
   * Get cached matrix block
   */
  getMatrixBlock(rowOffset, colOffset, rowLimit, colLimit) {
    const key = this.buildMatrixCacheKey(rowOffset, colOffset, rowLimit, colLimit);
    if (!key) return null;
    return this.matrixCache.get(key) || null;
  }

  /**
   * Request matrix block from server
   */
  async requestMatrixBlock(rowOffset, colOffset, rowLimit, colLimit) {
    const { matrixShape } = this.getComputedState();
    const { selectedPath } = this.state;
    const { displayDimsKey, fixedIndicesKey } = this.getComputedState();
    
    if (!this.fileKey || !selectedPath || !matrixShape) return;
    
    const safeRowLimit = Math.min(rowLimit, Math.max(0, matrixShape.rows - rowOffset));
    const safeColLimit = Math.min(colLimit, Math.max(0, matrixShape.cols - colOffset));
    if (safeRowLimit <= 0 || safeColLimit <= 0) return;
    
    const key = this.buildMatrixCacheKey(rowOffset, colOffset, safeRowLimit, safeColLimit);
    if (!key || this.matrixCache.has(key) || this.matrixPending.has(key)) return;
    
    this.matrixPending.add(key);
    this.setState({ matrixLoading: true, matrixError: null });
    
    try {
      const params = {
        mode: 'matrix',
        row_offset: rowOffset,
        row_limit: safeRowLimit,
        col_offset: colOffset,
        col_limit: safeColLimit
      };
      if (displayDimsKey) params.display_dims = displayDimsKey;
      if (fixedIndicesKey) params.fixed_indices = fixedIndicesKey;
      
      const data = await getFileData(this.fileKey, selectedPath, params);
      this.matrixCache.set(key, data);
      this.setState({ matrixVersion: this.state.matrixVersion + 1 });
    } catch (err) {
      this.setState({ matrixError: err.message || 'Failed to load matrix data' });
    } finally {
      this.matrixPending.delete(key);
      this.setState({ matrixLoading: this.matrixPending.size > 0 });
    }
  }

  /**
   * Enable matrix and fetch initial block
   */
  handleEnableMatrix() {
    const { matrixShape } = this.getComputedState();
    if (!matrixShape) return;
    
    this.setState({ matrixEnabled: true });
    const initialRows = Math.min(MATRIX_BLOCK_ROWS, matrixShape.rows);
    const initialCols = Math.min(MATRIX_BLOCK_COLS, matrixShape.cols);
    this.requestMatrixBlock(0, 0, initialRows, initialCols);
  }

  /**
   * Request heatmap data
   */
  async requestHeatmap(maxSize) {
    const { selectedPath } = this.state;
    const { selectionKey, displayDimsKey, fixedIndicesKey } = this.getComputedState();
    
    if (!this.fileKey || !selectedPath) return;
    
    const requestKey = `${selectionKey}|heatmap|max=${maxSize}`;
    if (this.heatmapKey === requestKey && this.state.heatmapData) return;
    
    this.setState({
      heatmapEnabled: true,
      heatmapLoading: true,
      heatmapError: null
    });
    this.heatmapKey = requestKey;
    
    try {
      const params = {
        mode: 'heatmap',
        max_size: maxSize
      };
      if (displayDimsKey) params.display_dims = displayDimsKey;
      if (fixedIndicesKey) params.fixed_indices = fixedIndicesKey;
      
      const data = await getFileData(this.fileKey, selectedPath, params);
      this.setState({ heatmapData: data });
    } catch (err) {
      this.setState({ heatmapError: err.message || 'Failed to load heatmap data' });
    } finally {
      this.setState({ heatmapLoading: false });
    }
  }

  /**
   * Resolve line chart parameters based on current state and visible range
   */
  resolveLineParams(range) {
    const { preview, displayDims } = this.state;
    if (!preview?.shape) return null;
    
    const shape = preview.shape;
    const ndim = preview.ndim ?? shape.length;
    let lineDim = null;
    let lineIndex = null;
    let lineLength = 0;
    
    if (ndim === 1) {
      lineLength = shape[0];
    } else if (Array.isArray(displayDims) && displayDims.length === 2) {
      const rows = shape[displayDims[0]];
      const cols = shape[displayDims[1]];
      lineDim = 'row';
      lineIndex = Math.floor(rows / 2);
      lineLength = cols;
    } else {
      lineLength = shape[0];
    }
    
    if (!Number.isFinite(lineLength) || lineLength <= 0) return null;
    
    let lineOffset = 0;
    let lineLimit = lineLength;
    if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
      const start = Math.max(0, Math.floor(Math.min(range.start, range.end)));
      const end = Math.min(lineLength - 1, Math.ceil(Math.max(range.start, range.end)));
      lineOffset = Math.min(start, lineLength - 1);
      lineLimit = Math.max(0, end - lineOffset + 1);
    }
    
    return {
      line_dim: lineDim,
      line_index: lineIndex,
      line_offset: lineOffset,
      line_limit: lineLimit,
      line_length: lineLength
    };
  }

  /**
   * Request line chart data
   */
  async requestLine(range) {
    const { selectedPath } = this.state;
    const { selectionKey, displayDimsKey, fixedIndicesKey } = this.getComputedState();
    
    if (!this.fileKey || !selectedPath) return;
    
    const params = this.resolveLineParams(range);
    if (!params) return;
    
    const requestKey = `${selectionKey}|line|${params.line_dim}|${params.line_index}|${params.line_offset}|${params.line_limit}`;
    if (this.lineKey === requestKey && this.state.lineData) return;
    
    this.setState({
      lineEnabled: true,
      lineLoading: true,
      lineError: null
    });
    this.lineKey = requestKey;
    
    try {
      const query = {
        mode: 'line',
        line_offset: params.line_offset,
        line_limit: params.line_limit
      };
      if (params.line_dim) query.line_dim = params.line_dim;
      if (Number.isFinite(params.line_index)) query.line_index = params.line_index;
      if (displayDimsKey) query.display_dims = displayDimsKey;
      if (fixedIndicesKey) query.fixed_indices = fixedIndicesKey;
      
      const data = await getFileData(this.fileKey, selectedPath, query);
      this.setState({ lineData: data });
    } catch (err) {
      this.setState({ lineError: err.message || 'Failed to load line data' });
    } finally {
      this.setState({ lineLoading: false });
    }
  }

  /**
   * Handle line chart view change (debounced)
   */
  handleLineViewChange(range) {
    if (!range) return;
    const normalizedRange = Array.isArray(range?.x) && range.x.length === 2
      ? { start: range.x[0], end: range.x[1] }
      : range;

    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }
    this.lineTimer = setTimeout(() => {
      this.requestLine(normalizedRange);
    }, 250);
  }

  /**
   * Handle staged display dimensions change
   */
  handleStagedDisplayDimsChange(nextDims, shape) {
    if (!Array.isArray(nextDims) || nextDims.length !== 2) return;
    
    const nextFixed = buildNextFixedIndices(this.state.stagedFixedIndices, nextDims, shape);
    this.setState({
      stagedDisplayDims: nextDims,
      stagedFixedIndices: nextFixed
    });
    
    // For 2D data, apply immediately (no staging needed)
    if (this.state.preview?.ndim === 2) {
      this.setState({
        displayDims: nextDims,
        fixedIndices: nextFixed
      });
    }
  }

  /**
   * Handle staged fixed index change
   */
  handleStagedFixedIndexChange(dim, value, size) {
    const max = Math.max(0, size - 1);
    const clamped = Math.max(0, Math.min(max, value));
    this.setState({
      stagedFixedIndices: {
        ...this.state.stagedFixedIndices,
        [dim]: clamped
      }
    });
  }

  /**
   * Apply staged dimension changes
   */
  handleApplyDimensions() {
    this.setState({
      displayDims: this.state.stagedDisplayDims,
      fixedIndices: this.state.stagedFixedIndices
    });
  }

  /**
   * Reset dimensions to defaults
   */
  handleResetDimensions() {
    const { preview } = this.state;
    if (!preview?.shape) return;
    
    const defaultDisplayDims = preview.display_dims || [0, 1];
    const defaultFixedIndices = {};
    
    preview.shape.forEach((size, dim) => {
      if (!defaultDisplayDims.includes(dim)) {
        defaultFixedIndices[dim] = Math.floor(size / 2);
      }
    });
    
    this.setState({
      stagedDisplayDims: defaultDisplayDims,
      stagedFixedIndices: defaultFixedIndices
    });
  }

  /**
   * Event handlers
   */
  handlePathSelect(path) {
    this.setState({ selectedPath: path });
  }

  handleModeChange(mode) {
    this.setState({ viewMode: mode });
  }

  handleTabChange(tab) {
    this.setState({ displayTab: tab });
  }

  handleNotationChange(notation) {
    this.setState({ notation });
  }

  handleLineGridChange(enabled) {
    this.setState({ lineGrid: enabled });
  }

  handleLineAspectChange(aspect) {
    this.setState({ lineAspect: aspect });
  }

  handleHeatmapGridChange(enabled) {
    this.setState({ heatmapGrid: enabled });
  }

  handleHeatmapColormapChange(colormap) {
    this.setState({ heatmapColormap: colormap });
  }

  handleHeatmapZoom(zoomLevel) {
    if (zoomLevel <= 1) return;
    this.requestHeatmap(HEATMAP_MAX_SIZE);
  }

  /**
   * Lifecycle: component mounted
   */
  onMount() {
    // Initial data fetch
    this.fetchMeta();
    this.fetchPreview();
  }

  /**
   * Lifecycle: state updated
   */
  onUpdate(prevState) {
    const { selectedPath, viewMode, displayDims, fixedIndices } = this.state;
    
    // File key changed - reset path
    // (Note: fileKey is a prop, not state, but we check on mount)
    
    // Selected path changed - reset everything
    if (prevState.selectedPath !== selectedPath) {
      this.setState({
        displayTab: 'table',
        displayDims: null,
        fixedIndices: {},
        stagedDisplayDims: null,
        stagedFixedIndices: {},
        preview: null,
        previewError: null,
        previewLoading: false,
        heatmapGrid: true,
        heatmapColormap: 'viridis'
      }, { skipEffects: true });
      this.resetDataState();
      this.fetchMeta();
      this.fetchPreview();
      return;
    }
    
    // View mode changed - fetch appropriate data
    if (prevState.viewMode !== viewMode) {
      this.fetchMeta();
      this.fetchPreview();
      return;
    }
    
    // Display dimensions or fixed indices changed - fetch preview and reset data
    const prevDisplayDims = prevState.displayDims?.join(',') || '';
    const currDisplayDims = displayDims?.join(',') || '';
    const prevFixedIndices = buildFixedIndicesParam(prevState.fixedIndices) || '';
    const currFixedIndices = buildFixedIndicesParam(fixedIndices) || '';
    
    if (prevDisplayDims !== currDisplayDims || prevFixedIndices !== currFixedIndices) {
      this.resetDataState();
      this.fetchPreview();
      return;
    }
  }

  /**
   * Ensure persistent viewer layout containers exist.
   */
  ensureLayout() {
    let sidebarTreeContainer = $('#viewer-sidebar-tree', this.container);
    let topbarContainer = $('#viewer-topbar', this.container);
    let toolbarContainer = $('#viewer-toolbar', this.container);
    let panelContainer = $('#viewer-panel', this.container);

    if (!sidebarTreeContainer || !topbarContainer || !toolbarContainer || !panelContainer) {
      this.container.innerHTML = `
      <div class="viewer-page">
        <aside class="viewer-sidebar">
          <div class="sidebar-top">
            <div class="sidebar-title">Explorer</div>
            <span class="file-pill">${this.fileKey || 'Unknown file'}</span>
          </div>
          <div class="sidebar-section">
            <div class="section-label">File Tree</div>
            <div class="sidebar-tree" id="viewer-sidebar-tree"></div>
          </div>
        </aside>
        <section class="viewer-main">
          <div id="viewer-topbar"></div>
          <div id="viewer-toolbar"></div>
          <div id="viewer-panel"></div>
        </section>
      </div>
    `;

      sidebarTreeContainer = $('#viewer-sidebar-tree', this.container);
      topbarContainer = $('#viewer-topbar', this.container);
      toolbarContainer = $('#viewer-toolbar', this.container);
      panelContainer = $('#viewer-panel', this.container);
    }

    return {
      sidebarTreeContainer,
      topbarContainer,
      toolbarContainer,
      panelContainer
    };
  }

  /**
   * Render the component
   */
  render() {
    const {
      selectedPath,
      viewMode,
      meta,
      metaLoading,
      metaError,
      preview,
      previewLoading,
      previewError,
      displayTab,
      displayDims,
      fixedIndices,
      stagedDisplayDims,
      stagedFixedIndices,
      notation,
      lineGrid,
      lineAspect,
      heatmapGrid,
      heatmapColormap,
      matrixEnabled,
      matrixLoading,
      matrixError,
      matrixVersion,
      heatmapEnabled,
      heatmapLoading,
      heatmapError,
      heatmapData,
      lineEnabled,
      lineLoading,
      lineError,
      lineData
    } = this.state;

    const { showHeatmap, matrixShape } = this.getComputedState();
    const {
      sidebarTreeContainer,
      topbarContainer,
      toolbarContainer,
      panelContainer
    } = this.ensureLayout();

    const sidebarProps = {
      fileKey: this.fileKey,
      selectedPath,
      onSelect: (path) => this.handlePathSelect(path)
    };
    if (!this.sidebarTree) {
      this.sidebarTree = new SidebarTree(sidebarTreeContainer, sidebarProps);
    } else {
      this.sidebarTree.updateProps(sidebarProps);
    }

    const topBarProps = {
      fileKey: this.fileKey,
      selectedPath,
      viewMode,
      onModeChange: (mode) => this.handleModeChange(mode),
      onBack: () => navigateToHome()
    };
    if (!this.topBar) {
      this.topBar = new TopBar(topbarContainer, topBarProps);
    } else {
      this.topBar.updateProps(topBarProps);
    }

    if (viewMode === 'display') {
      const toolbarProps = {
        activeTab: displayTab,
        onTabChange: (tab) => this.handleTabChange(tab),
        showHeatmap,
        onExport: () => {},
        disabled: !preview || previewLoading,
        notation,
        onNotationChange: (n) => this.handleNotationChange(n),
        lineGrid,
        onLineGridChange: (enabled) => this.handleLineGridChange(enabled),
        lineAspect,
        onLineAspectChange: (aspect) => this.handleLineAspectChange(aspect),
        heatmapGrid,
        onHeatmapGridChange: (enabled) => this.handleHeatmapGridChange(enabled),
        heatmapColormap,
        onHeatmapColormapChange: (colormap) => this.handleHeatmapColormapChange(colormap)
      };

      if (!this.previewToolbar) {
        this.previewToolbar = new PreviewToolbar(toolbarContainer, toolbarProps);
      } else {
        this.previewToolbar.updateProps(toolbarProps);
      }
    } else {
      if (this.previewToolbar) {
        this.previewToolbar.destroy();
        this.previewToolbar = null;
      }
      toolbarContainer.innerHTML = '';
    }

    const panelProps = {
      selectedPath,
      viewMode,
      meta,
      loading: metaLoading,
      error: metaError,
      preview,
      previewLoading,
      previewError,
      activeTab: displayTab,
      displayDims,
      fixedIndices,
      stagedDisplayDims,
      stagedFixedIndices,
      onDisplayDimsChange: (nextDims, shape) => this.handleStagedDisplayDimsChange(nextDims, shape),
      onFixedIndexChange: (dim, value, size) => this.handleStagedFixedIndexChange(dim, value, size),
      onApplyDimensions: () => this.handleApplyDimensions(),
      onResetDimensions: () => this.handleResetDimensions(),
      notation,
      lineGrid,
      lineAspect,
      heatmapGrid,
      heatmapColormap,
      matrixEnabled,
      matrixLoading,
      matrixError,
      matrixVersion,
      matrixShape,
      matrixBlockSize: { rows: MATRIX_BLOCK_ROWS, cols: MATRIX_BLOCK_COLS },
      getMatrixBlock: (r, c, rl, cl) => this.getMatrixBlock(r, c, rl, cl),
      onRequestMatrixBlock: (r, c, rl, cl) => this.requestMatrixBlock(r, c, rl, cl),
      onEnableMatrix: () => this.handleEnableMatrix(),
      heatmapEnabled,
      heatmapLoading,
      heatmapError,
      heatmapData,
      onEnableHeatmap: () => this.requestHeatmap(HEATMAP_MAX_SIZE),
      onHeatmapZoom: (zoom) => this.handleHeatmapZoom(zoom),
      lineEnabled,
      lineLoading,
      lineError,
      lineData,
      onEnableLine: () => this.requestLine(null),
      onLineViewChange: (range) => this.handleLineViewChange(range)
    };

    if (!this.viewerPanel) {
      this.viewerPanel = new ViewerPanel(panelContainer, panelProps);
    } else {
      this.viewerPanel.updateProps(panelProps);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.lineTimer) {
      clearTimeout(this.lineTimer);
    }
    if (this.sidebarTree) this.sidebarTree.destroy();
    if (this.topBar) this.topBar.destroy();
    if (this.previewToolbar) this.previewToolbar.destroy();
    if (this.viewerPanel) this.viewerPanel.destroy();
    super.destroy();
  }
}
