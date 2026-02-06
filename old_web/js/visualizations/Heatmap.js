import Component from '../components/Component.js';
import { formatWithNotation } from '../utils/formatters.js';

/**
 * Colormap definitions
 */
const COLORMAPS = {
  viridis: [
    [68, 1, 84], [72, 40, 120], [62, 73, 137], [49, 104, 142],
    [38, 130, 142], [31, 158, 137], [53, 183, 121], [110, 206, 88],
    [181, 222, 43], [253, 231, 37]
  ],
  plasma: [
    [13, 8, 135], [75, 3, 161], [125, 3, 168], [168, 34, 150],
    [203, 70, 121], [229, 107, 93], [248, 148, 65], [253, 195, 40],
    [243, 240, 29], [240, 249, 33]
  ],
  inferno: [
    [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
    [212, 72, 66], [245, 125, 21], [250, 193, 39], [242, 240, 158],
    [252, 255, 164], [252, 255, 164]
  ],
  magma: [
    [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
    [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135],
    [252, 253, 191], [252, 253, 191]
  ],
  cool: [
    [0, 255, 255], [28, 226, 255], [57, 198, 255], [85, 170, 255],
    [113, 142, 255], [142, 113, 255], [170, 85, 255], [198, 57, 255],
    [226, 28, 255], [255, 0, 255]
  ],
  hot: [
    [11, 0, 0], [87, 0, 0], [163, 0, 0], [239, 0, 0],
    [255, 76, 0], [255, 152, 0], [255, 228, 0], [255, 255, 51],
    [255, 255, 153], [255, 255, 255]
  ]
};

/**
 * Get RGB color from colormap at normalized position [0, 1]
 */
function getColor(colormap, t) {
  const colors = COLORMAPS[colormap] || COLORMAPS.viridis;
  const n = colors.length - 1;
  const idx = Math.min(Math.max(t * n, 0), n);
  const i1 = Math.floor(idx);
  const i2 = Math.min(i1 + 1, n);
  const frac = idx - i1;
  
  const c1 = colors[i1];
  const c2 = colors[i2];
  
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * frac);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * frac);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * frac);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Heatmap Component
 * 
 * Renders 2D data as colored cells with zoom/pan and colormap selection
 * 
 * Props:
 * - data: {values: number[][], rows: number, cols: number, vmin: number, vmax: number, max_size_clamped: boolean, effective_max_size: number}
 * - colormap: string (default: 'viridis')
 * - showGrid: boolean (default: false)
 * - loading: boolean
 * - error: string
 * - notation: 'auto' | 'scientific' | 'exact'
 * - onZoomChange: (zoom: number) => void
 */
export default class Heatmap extends Component {
  constructor(container, props) {
    super(container);
    
    this.props = {
      data: null,
      colormap: 'viridis',
      showGrid: false,
      loading: false,
      error: null,
      notation: 'auto',
      onZoomChange: null,
      ...props
    };
    
    // State
    this.cellSize = 20; // pixels per cell
    this.minCellSize = 5;
    this.maxCellSize = 100;
    this.pan = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.tooltip = null;
    
    // Resizeobserver
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    
    this.render();
  }
  
  /**
   * Update props
   */
  updateProps(props) {
    const oldData = this.props.data;
    this.props = { ...this.props, ...props };
    
    // Reset pan/zoom if data changed
    if (this.props.data !== oldData) {
      this.cellSize = 20;
      this.pan = { x: 0, y: 0 };
    }
    
    this.render();
  }
  
  /**
   * Render
   */
  render() {
    const { data, colormap, showGrid, loading, error, notation } = this.props;
    
    let html = '<div class="heatmap">';
    
    // Show loading state
    if (loading) {
      html += `
        <div class="chart-state">
          <div class="loading-spinner"></div>
          <div class="state-text">Loading heatmap...</div>
        </div>
      `;
    }
    // Show error state
    else if (error) {
      html += `
        <div class="chart-state">
          <div class="state-text error-text">${error}</div>
        </div>
      `;
    }
    // Show data
    else if (data && data.values && data.values.length > 0) {
      // Clamp warning
      if (data.max_size_clamped) {
        html += `
          <div class="heatmap-warning">
            ⚠️ Heatmap clamped to ${data.effective_max_size} elements. Zoom in for higher resolution.
          </div>
        `;
      }
      
      // Controls
      html += '<div class="heatmap-controls">';
      
      // Colormap selector
      html += '<div class="control-group">';
      html += '<label>Colormap:</label>';
      html += '<select class="colormap-select">';
      Object.keys(COLORMAPS).forEach(name => {
        const selected = name === colormap ? 'selected' : '';
        html += `<option value="${name}" ${selected}>${name}</option>`;
      });
      html += '</select>';
      html += '</div>';
      
      // Grid toggle
      html += '<div class="control-group">';
      html += `<label><input type="checkbox" class="grid-toggle" ${showGrid ? 'checked' : ''}> Show Grid</label>`;
      html += '</div>';
      
      // Zoom controls
      html += '<div class="control-group">';
      html += '<button class="control-btn" data-action="zoom-in">+</button>';
      html += '<button class="control-btn" data-action="zoom-out">−</button>';
      html += '<button class="control-btn" data-action="reset">Reset</button>';
      html += '</div>';
      
      html += '</div>'; // heatmap-controls
      
      // Canvas container
      html += '<div class="heatmap-canvas-container">';
      html += '<div class="heatmap-canvas"></div>';
      html += '</div>';
      
      // Color scale legend
      html += '<div class="heatmap-legend">';
      html += '<div class="legend-title">Scale</div>';
      html += '<div class="legend-gradient"></div>';
      html += '<div class="legend-labels">';
      html += `<span>${formatWithNotation(data.vmin, notation)}</span>`;
      html += `<span>${formatWithNotation(data.vmax, notation)}</span>`;
      html += '</div>';
      html += '</div>';
    }
    // No data
    else {
      html += `
        <div class="chart-state">
          <div class="state-text">No heatmap data available.</div>
        </div>
      `;
    }
    
    html += '</div>'; // heatmap
    
    this.container.innerHTML = html;
    
    // Attach events and render canvas
    if (data && data.values && data.values.length > 0 && !loading && !error) {
      this.attachEventListeners();
      this.renderCanvas();
      this.renderLegendGradient();
      
      // Start observing
      const canvasContainer = this.container.querySelector('.heatmap-canvas-container');
      if (canvasContainer) {
        this.resizeObserver.observe(canvasContainer);
      }
    }
  }
  
  /**
   * Render canvas content
   */
  renderCanvas() {
    const { data, colormap, showGrid, notation } = this.props;
    if (!data || !data.values) return;
    
    const canvas = this.container.querySelector('.heatmap-canvas');
    if (!canvas) return;
    
    const { rows, cols, values, vmin, vmax } = data;
    const range = vmax - vmin;
    
    // Calculate dimensions
    const width = cols * this.cellSize;
    const height = rows * this.cellSize;
    
    // Build SVG
    let svg = `<svg class="heatmap-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    
    // Render cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const value = values[r]?.[c];
        if (value == null) continue;
        
        const t = range > 0 ? (value - vmin) / range : 0.5;
        const color = getColor(colormap, t);
        
        const x = c * this.cellSize;
        const y = r * this.cellSize;
        
        svg += `<rect x="${x}" y="${y}" width="${this.cellSize}" height="${this.cellSize}" fill="${color}" data-row="${r}" data-col="${c}" data-value="${value}" />`;
      }
    }
    
    // Grid lines
    if (showGrid && this.cellSize >= 10) {
      svg += '<g class="grid-lines">';
      // Horizontal lines
      for (let r = 0; r <= rows; r++) {
        const y = r * this.cellSize;
        svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`;
      }
      // Vertical lines
      for (let c = 0; c <= cols; c++) {
        const x = c * this.cellSize;
        svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`;
      }
      svg += '</g>';
    }
    
    svg += '</svg>';
    
    canvas.innerHTML = svg;
  }
  
  /**
   * Render legend gradient
   */
  renderLegendGradient() {
    const { colormap } = this.props;
    const gradient = this.container.querySelector('.legend-gradient');
    if (!gradient) return;
    
    // Generate gradient SVG
    let svg = '<svg width="100%" height="20">';
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const color = getColor(colormap, t);
      const x = (i / steps) * 100;
      const w = (100 / steps) + 0.5; // slight overlap to avoid gaps
      svg += `<rect x="${x}%" y="0" width="${w}%" height="20" fill="${color}" />`;
    }
    svg += '</svg>';
    
    gradient.innerHTML = svg;
  }
  
  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Colormap change
    const colormapSelect = this.container.querySelector('.colormap-select');
    if (colormapSelect) {
      colormapSelect.addEventListener('change', (e) => {
        this.props.colormap = e.target.value;
        this.renderCanvas();
        this.renderLegendGradient();
      });
    }
    
    // Grid toggle
    const gridToggle = this.container.querySelector('.grid-toggle');
    if (gridToggle) {
      gridToggle.addEventListener('change', (e) => {
        this.props.showGrid = e.target.checked;
        this.renderCanvas();
      });
    }
    
    // Zoom/reset buttons
    this.on('click', '.control-btn', (e, target) => {
      const action = target.dataset.action;
      if (action === 'zoom-in') {
        this.handleZoom(1.2);
      } else if (action === 'zoom-out') {
        this.handleZoom(0.8);
      } else if (action === 'reset') {
        this.cellSize = 20;
        this.pan = { x: 0, y: 0 };
        this.renderCanvas();
        this.notifyZoomChange();
      }
    });
    
    // Canvas interactions
    const canvas = this.container.querySelector('.heatmap-canvas');
    if (canvas) {
      // Wheel zoom
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.handleZoom(delta);
      });
      
      // Drag pan
      canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.dragStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        canvas.style.cursor = 'grabbing';
      });
      
      canvas.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          this.pan.x = e.clientX - this.dragStart.x;
          this.pan.y = e.clientY - this.dragStart.y;
          this.renderCanvas();
        } else {
          // Hover tooltip
          this.handleHover(e);
        }
      });
      
      canvas.addEventListener('mouseup', () => {
        this.isDragging = false;
        canvas.style.cursor = 'grab';
      });
      
      canvas.addEventListener('mouseleave', () => {
        this.isDragging = false;
        canvas.style.cursor = 'grab';
        this.hideTooltip();
      });
    }
  }
  
  /**
   * Handle zoom
   */
  handleZoom(factor) {
    const oldSize = this.cellSize;
    this.cellSize = Math.min(Math.max(this.cellSize * factor, this.minCellSize), this.maxCellSize);
    
    // If cellSize actually changed, re-render
    if (this.cellSize !== oldSize) {
      this.renderCanvas();
      this.notifyZoomChange();
    }
  }
  
  /**
   * Notify parent of zoom change
   */
  notifyZoomChange() {
    if (this.props.onZoomChange) {
      // Calculate zoom level (1 = default 20px per cell)
      const zoom = this.cellSize / 20;
      this.props.onZoomChange(zoom);
    }
  }
  
  /**
   * Handle hover to show tooltip
   */
  handleHover(e) {
    const rect = e.target.closest('rect[data-row]');
    if (!rect) {
      this.hideTooltip();
      return;
    }
    
    const row = rect.dataset.row;
    const col = rect.dataset.col;
    const value = rect.dataset.value;
    
    this.showTooltip(e.clientX, e.clientY, `Row: ${row}, Col: ${col}\nValue: ${value}`);
  }
  
  /**
   * Show tooltip
   */
  showTooltip(x, y, text) {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'chart-tooltip';
      document.body.appendChild(this.tooltip);
    }
    
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${x + 10}px`;
    this.tooltip.style.top = `${y + 10}px`;
    this.tooltip.style.display = 'block';
  }
  
  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
  
  /**
   * Handle resize
   */
  handleResize() {
    // Re-render canvas to adjust to new container size
    this.renderCanvas();
  }
  
  /**
   * Destroy
   */
  destroy() {
    this.resizeObserver.disconnect();
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    super.destroy();
  }
}
