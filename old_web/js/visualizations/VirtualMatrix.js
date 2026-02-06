/**
 * VirtualMatrix.js
 * Virtual scrolling matrix component for large dataset visualization
 * 
 * Features:
 * - Block-based lazy loading (200 rows × 50 cols per block)
 * - Fixed row/column headers
 * - Viewport calculation with overscan
 * - Smooth scrolling for large datasets
 * - Cache integration with parent component
 */

import { Component } from '../components/Component.js';
import { formatWithNotation } from '../utils/formatters.js';

// Constants (Must match plan specification)
const ROW_HEIGHT = 28;
const COL_WIDTH = 96;
const HEADER_HEIGHT = 28;
const INDEX_WIDTH = 60;
const OVERSCAN = 4; // Number of extra blocks to render beyond viewport

/**
 * Calculate which blocks are visible in the current viewport
 */
function getVisibleBlocks(scrollTop, scrollLeft, viewportWidth, viewportHeight, totalRows, totalCols, blockRows, blockCols) {
  // Account for headers
  const contentTop = Math.max(0, scrollTop - HEADER_HEIGHT);
  const contentLeft = Math.max(0, scrollLeft - INDEX_WIDTH);
  
  // Calculate visible row range
  const startRow = Math.max(0, Math.floor(contentTop / ROW_HEIGHT));
  const endRow = Math.min(totalRows - 1, Math.ceil((contentTop + viewportHeight) / ROW_HEIGHT));
  
  // Calculate visible column range
  const startCol = Math.max(0, Math.floor(contentLeft / COL_WIDTH));
  const endCol = Math.min(totalCols - 1, Math.ceil((contentLeft + viewportWidth) / COL_WIDTH));
  
  // Convert to block indices
  const startBlockRow = Math.floor(startRow / blockRows);
  const endBlockRow = Math.floor(endRow / blockRows);
  const startBlockCol = Math.floor(startCol / blockCols);
  const endBlockCol = Math.floor(endCol / blockCols);
  
  // Add overscan
  const overscanStartBlockRow = Math.max(0, startBlockRow - OVERSCAN);
  const overscanEndBlockRow = Math.min(Math.floor((totalRows - 1) / blockRows), endBlockRow + OVERSCAN);
  const overscanStartBlockCol = Math.max(0, startBlockCol - OVERSCAN);
  const overscanEndBlockCol = Math.min(Math.floor((totalCols - 1) / blockCols), endBlockCol + OVERSCAN);
  
  const blocks = [];
  for (let br = overscanStartBlockRow; br <= overscanEndBlockRow; br++) {
    for (let bc = overscanStartBlockCol; bc <= overscanEndBlockCol; bc++) {
      blocks.push({ blockRow: br, blockCol: bc });
    }
  }
  
  return blocks;
}

/**
 * Format cell value with notation
 */
function formatCellValue(value, notation) {
  if (value === null || value === undefined) {
    return '--';
  }
  if (typeof value === 'number') {
    return formatWithNotation(value, notation);
  }
  return String(value);
}

/**
 * VirtualMatrix Component
 * Renders large matrices efficiently using virtual scrolling
 */
export class VirtualMatrix extends Component {
  constructor(container, props = {}) {
    super(container);
    
    this.props = {
      shape: null,              // { rows, cols }
      blockSize: null,          // { rows, cols }
      notation: 'auto',         // 'auto' | 'scientific' | 'exact'
      version: 0,               // Incrementing version for cache invalidation
      getBlock: null,           // Function(blockRow, blockCol, blockRowLen, blockColLen) => block data
      onRequestBlock: null,     // Function(blockRow, blockCol, blockRowLen, blockColLen) => void
      loading: false,
      error: null,
      ...props
    };
    
    // Internal state
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.visibleBlocks = [];
    this.renderedBlocks = new Map(); // blockKey -> DOM element
    
    // Refs
    this.scrollContainer = null;
    this.canvas = null;
    this.fixedCorner = null;
    this.fixedRowHeader = null;
    this.fixedColHeader = null;
    
    this.render();
  }
  
  /**
   * Update props from parent
   */
  updateProps(newProps) {
    const versionChanged = newProps.version !== this.props.version;
    this.props = { ...this.props, ...newProps };
    
    if (versionChanged) {
      // Clear rendered blocks on version change
      this.renderedBlocks.clear();
    }
    
    this.render();
    this.updateViewport();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.scrollContainer) return;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Scroll event with RAF throttling
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        this.handleScroll();
        rafId = null;
      });
    };
    
    this.listen(this.scrollContainer, 'scroll', handleScroll);
    
    // Resize observer for viewport changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateViewport();
      });
      this.resizeObserver.observe(this.scrollContainer);
    }
  }
  
  /**
   * Handle scroll event
   */
  handleScroll() {
    if (!this.scrollContainer) return;
    
    this.scrollTop = this.scrollContainer.scrollTop;
    this.scrollLeft = this.scrollContainer.scrollLeft;
    
    // Update fixed headers
    this.updateFixedHeaders();
    
    // Update visible blocks
    this.updateVisibleBlocks();
  }
  
  /**
   * Update fixed header positions
   */
  updateFixedHeaders() {
    if (this.fixedRowHeader) {
      this.fixedRowHeader.style.transform = `translateX(${-this.scrollLeft}px)`;
    }
    if (this.fixedColHeader) {
      this.fixedColHeader.style.transform = `translateY(${-this.scrollTop}px)`;
    }
  }
  
  /**
   * Update viewport dimensions
   */
  updateViewport() {
    if (!this.scrollContainer) return;
    
    const rect = this.scrollContainer.getBoundingClientRect();
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
    
    this.updateVisibleBlocks();
  }
  
  /**
   * Calculate and update visible blocks
   */
  updateVisibleBlocks() {
    const { shape, blockSize } = this.props;
    if (!shape || !blockSize) return;
    
    const blocks = getVisibleBlocks(
      this.scrollTop,
      this.scrollLeft,
      this.viewportWidth,
      this.viewportHeight,
      shape.rows,
      shape.cols,
      blockSize.rows,
      blockSize.cols
    );
    
    this.visibleBlocks = blocks;
    this.renderBlocks();
  }
  
  /**
   * Render visible blocks
   */
  renderBlocks() {
    const { shape, blockSize, getBlock, onRequestBlock } = this.props;
    if (!shape || !blockSize || !this.canvas) return;
    
    // Request missing blocks
    this.visibleBlocks.forEach(({ blockRow, blockCol }) => {
      const blockKey = `${blockRow},${blockCol}`;
      const rowOffset = blockRow * blockSize.rows;
      const colOffset = blockCol * blockSize.cols;
      const rowLimit = Math.min(blockSize.rows, Math.max(0, shape.rows - rowOffset));
      const colLimit = Math.min(blockSize.cols, Math.max(0, shape.cols - colOffset));
      if (rowLimit <= 0 || colLimit <= 0) return;
      
      // Check if block is already rendered
      if (this.renderedBlocks.has(blockKey)) return;
      
      // Check if block data exists in parent cache
      const blockData = getBlock ? getBlock(rowOffset, colOffset, rowLimit, colLimit) : null;
      
      if (blockData) {
        // Render the block
        this.renderBlock(blockRow, blockCol, blockData);
      } else {
        // Request the block from parent
        if (onRequestBlock) {
          onRequestBlock(rowOffset, colOffset, rowLimit, colLimit);
        }
        
        // Render loading placeholder
        this.renderBlockPlaceholder(blockRow, blockCol);
      }
    });
    
    // Clean up blocks outside visible range
    const visibleKeys = new Set(this.visibleBlocks.map(({ blockRow, blockCol }) => `${blockRow},${blockCol}`));
    const keysToRemove = [];
    
    this.renderedBlocks.forEach((element, key) => {
      if (!visibleKeys.has(key)) {
        keysToRemove.push(key);
        element.remove();
      }
    });
    
    keysToRemove.forEach(key => this.renderedBlocks.delete(key));
  }
  
  /**
   * Render a single block with data
   */
  renderBlock(blockRow, blockCol, blockData) {
    const { shape, blockSize, notation } = this.props;
    const blockKey = `${blockRow},${blockCol}`;
    
    // Check if already rendered
    if (this.renderedBlocks.has(blockKey)) {
      const existing = this.renderedBlocks.get(blockKey);
      existing.remove();
      this.renderedBlocks.delete(blockKey);
    }
    
    const startRow = blockRow * blockSize.rows;
    const startCol = blockCol * blockSize.cols;
    const endRow = Math.min(startRow + blockSize.rows, shape.rows);
    const endCol = Math.min(startCol + blockSize.cols, shape.cols);

    const matrixData = Array.isArray(blockData?.data)
      ? blockData.data
      : (Array.isArray(blockData) ? blockData : []);
    const rowBase = Number.isFinite(Number(blockData?.row_offset))
      ? Number(blockData.row_offset)
      : startRow;
    const colBase = Number.isFinite(Number(blockData?.col_offset))
      ? Number(blockData.col_offset)
      : startCol;
    
    const blockDiv = document.createElement('div');
    blockDiv.className = 'matrix-block';
    blockDiv.style.position = 'absolute';
    blockDiv.style.left = `${INDEX_WIDTH + startCol * COL_WIDTH}px`;
    blockDiv.style.top = `${HEADER_HEIGHT + startRow * ROW_HEIGHT}px`;
    
    // Render cells
    const cells = [];
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const localRow = r - rowBase;
        const localCol = c - colBase;
        const value = matrixData?.[localRow]?.[localCol];
        
        const cellDiv = document.createElement('div');
        cellDiv.className = 'matrix-cell';
        cellDiv.style.position = 'absolute';
        cellDiv.style.left = `${(c - startCol) * COL_WIDTH}px`;
        cellDiv.style.top = `${(r - startRow) * ROW_HEIGHT}px`;
        cellDiv.style.width = `${COL_WIDTH}px`;
        cellDiv.style.height = `${ROW_HEIGHT}px`;
        cellDiv.textContent = formatCellValue(value, notation);
        
        cells.push(cellDiv);
      }
    }
    
    cells.forEach(cell => blockDiv.appendChild(cell));
    
    this.canvas.appendChild(blockDiv);
    this.renderedBlocks.set(blockKey, blockDiv);
  }
  
  /**
   * Render loading placeholder for a block
   */
  renderBlockPlaceholder(blockRow, blockCol) {
    const { shape, blockSize } = this.props;
    const blockKey = `${blockRow},${blockCol}`;
    
    // Check if already rendered
    if (this.renderedBlocks.has(blockKey)) return;
    
    const startRow = blockRow * blockSize.rows;
    const startCol = blockCol * blockSize.cols;
    const rows = Math.min(blockSize.rows, shape.rows - startRow);
    const cols = Math.min(blockSize.cols, shape.cols - startCol);
    
    const blockDiv = document.createElement('div');
    blockDiv.className = 'matrix-block matrix-block-loading';
    blockDiv.style.position = 'absolute';
    blockDiv.style.left = `${INDEX_WIDTH + startCol * COL_WIDTH}px`;
    blockDiv.style.top = `${HEADER_HEIGHT + startRow * ROW_HEIGHT}px`;
    blockDiv.style.width = `${cols * COL_WIDTH}px`;
    blockDiv.style.height = `${rows * ROW_HEIGHT}px`;
    blockDiv.innerHTML = '<div class="loading-spinner small"></div>';
    
    this.canvas.appendChild(blockDiv);
    this.renderedBlocks.set(blockKey, blockDiv);
  }
  
  /**
   * Render component
   */
  render() {
    this.clearListeners();
    const { shape, loading, error } = this.props;
    
    if (loading) {
      this.container.innerHTML = `
        <div class="matrix-state">
          <div class="loading-spinner"></div>
          <div class="state-text">Loading matrix...</div>
        </div>
      `;
      return;
    }
    
    if (error) {
      this.container.innerHTML = `
        <div class="matrix-state error">
          <div class="state-text error-text">${error}</div>
        </div>
      `;
      return;
    }
    
    if (!shape || shape.rows === 0 || shape.cols === 0) {
      this.container.innerHTML = `
        <div class="matrix-state">
          <div class="state-text">No data to display</div>
        </div>
      `;
      return;
    }
    
    // Calculate total dimensions
    const totalWidth = INDEX_WIDTH + shape.cols * COL_WIDTH;
    const totalHeight = HEADER_HEIGHT + shape.rows * ROW_HEIGHT;
    
    this.container.innerHTML = `
      <div class="virtual-matrix">
        <div class="matrix-scroll-container">
          <div class="matrix-canvas" style="width: ${totalWidth}px; height: ${totalHeight}px;">
            <!-- Fixed corner -->
            <div class="matrix-fixed-corner" style="width: ${INDEX_WIDTH}px; height: ${HEADER_HEIGHT}px;"></div>
            
            <!-- Fixed row header (horizontal scroll) -->
            <div class="matrix-fixed-row-header" style="left: ${INDEX_WIDTH}px; height: ${HEADER_HEIGHT}px;">
              ${this.renderColumnHeaders(shape.cols)}
            </div>
            
            <!-- Fixed column header (vertical scroll) -->
            <div class="matrix-fixed-col-header" style="width: ${INDEX_WIDTH}px; top: ${HEADER_HEIGHT}px;">
              ${this.renderRowHeaders(shape.rows)}
            </div>
            
            <!-- Data area (scrollable) -->
            <div class="matrix-data"></div>
          </div>
        </div>
      </div>
    `;
    
    // Get refs
    this.scrollContainer = this.container.querySelector('.matrix-scroll-container');
    this.canvas = this.container.querySelector('.matrix-canvas');
    this.fixedCorner = this.container.querySelector('.matrix-fixed-corner');
    this.fixedRowHeader = this.container.querySelector('.matrix-fixed-row-header');
    this.fixedColHeader = this.container.querySelector('.matrix-fixed-col-header');

    this.setupEventListeners();
    this.updateViewport();
  }
  
  /**
   * Render column headers
   */
  renderColumnHeaders(totalCols) {
    let html = '';
    for (let col = 0; col < totalCols; col++) {
      html += `
        <div class="matrix-header-cell" style="left: ${col * COL_WIDTH}px; width: ${COL_WIDTH}px; height: ${HEADER_HEIGHT}px;">
          ${col}
        </div>
      `;
    }
    return html;
  }
  
  /**
   * Render row headers
   */
  renderRowHeaders(totalRows) {
    let html = '';
    for (let row = 0; row < totalRows; row++) {
      html += `
        <div class="matrix-header-cell" style="top: ${row * ROW_HEIGHT}px; width: ${INDEX_WIDTH}px; height: ${ROW_HEIGHT}px;">
          ${row}
        </div>
      `;
    }
    return html;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    this.renderedBlocks.clear();
    super.destroy();
  }
}

export default VirtualMatrix;
