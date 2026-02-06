/**
 * LineChart.js
 * SVG line chart component with zoom/pan/hover interactions
 * 
 * Features:
 * - Line/point/both rendering modes
 * - Zoom and pan with mouse/touch
 * - Grid overlay toggle
 * - Hover tooltips with data point info
 * - Fullscreen mode
 * - Debounced onViewChange callback for data refetch
 */

import { Component } from '../components/Component.js';
import { formatWithNotation } from '../utils/formatters.js';
import { debounce } from '../utils/debounce.js';

// Constants
const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };
const ZOOM_FACTOR = 1.2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 100;

/**
 * LineChart Component
 * Renders line chart with zoom/pan/hover interactions
 */
export class LineChart extends Component {
  constructor(container, props = {}) {
    super(container);
    
    this.props = {
      data: null,           // { x: [], y: [] } or { data: [[x, y], ...] }
      aspect: 'line',       // 'line' | 'point' | 'both'
      showGrid: true,
      loading: false,
      error: null,
      notation: 'auto',
      onViewChange: null,   // Callback(range) when view changes
      ...props
    };
    
    // Internal state
    this.svgWidth = 0;
    this.svgHeight = 0;
    this.chartWidth = 0;
    this.chartHeight = 0;
    this.xScale = { min: 0, max: 1 };
    this.yScale = { min: 0, max: 1 };
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.isFullscreen = false;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.tooltip = null;
    
    // Debounced view change callback
    this.debouncedViewChange = this.props.onViewChange 
      ? debounce(this.props.onViewChange, 250)
      : null;
    
    // Refs
    this.svgElement = null;
    this.chartGroup = null;
    
    this.render();
  }
  
  /**
   * Update props from parent
   */
  updateProps(newProps) {
    const dataChanged = newProps.data !== this.props.data;
    this.props = { ...this.props, ...newProps };
    
    if (dataChanged) {
      this.resetView();
    }
    
    this.render();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.svgElement) return;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    // Mouse wheel for zoom
    const handleWheel = (e) => {
      e.preventDefault();
      this.handleZoom(e.deltaY < 0 ? 1 : -1, e.offsetX, e.offsetY);
    };
    this.listen(this.svgElement, 'wheel', handleWheel, { passive: false });
    
    // Mouse drag for pan
    const handleMouseDown = (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
    };
    this.listen(this.svgElement, 'mousedown', handleMouseDown);
    
    const handleMouseMove = (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.handlePan(dx, dy);
        this.dragStart = { x: e.clientX, y: e.clientY };
      } else {
        this.handleHover(e.offsetX, e.offsetY);
      }
    };
    this.listen(document, 'mousemove', handleMouseMove);
    
    const handleMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.notifyViewChange();
      }
    };
    this.listen(document, 'mouseup', handleMouseUp);
    
    // Resize observer for container size changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDimensions();
      });
      this.resizeObserver.observe(this.container);
    }
  }
  
  /**
   * Handle zoom
   */
  handleZoom(direction, mouseX, mouseY) {
    const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    
    if (newZoom === this.zoom) return;
    
    // Zoom towards mouse position
    const xRatio = (mouseX - MARGIN.left) / this.chartWidth;
    const yRatio = (mouseY - MARGIN.top) / this.chartHeight;
    
    const oldXRange = (this.xScale.max - this.xScale.min) / this.zoom;
    const oldYRange = (this.yScale.max - this.yScale.min) / this.zoom;
    
    const newXRange = (this.xScale.max - this.xScale.min) / newZoom;
    const newYRange = (this.yScale.max - this.yScale.min) / newZoom;
    
    this.pan.x += (oldXRange - newXRange) * xRatio;
    this.pan.y += (oldYRange - newYRange) * (1 - yRatio);
    
    this.zoom = newZoom;
    
    this.renderChart();
    this.notifyViewChange();
  }
  
  /**
   * Handle pan
   */
  handlePan(dx, dy) {
    const xRange = (this.xScale.max - this.xScale.min) / this.zoom;
    const yRange = (this.yScale.max - this.yScale.min) / this.zoom;
    
    this.pan.x -= (dx / this.chartWidth) * xRange;
    this.pan.y += (dy / this.chartHeight) * yRange;
    
    this.renderChart();
  }
  
  /**
   * Handle hover
   */
  handleHover(mouseX, mouseY) {
    if (!this.props.data || this.isDragging) {
      this.hideTooltip();
      return;
    }
    
    const x = this.screenToDataX(mouseX);
    const y = this.screenToDataY(mouseY);
    
    // Find nearest point
    const points = this.getDataPoints();
    if (points.length === 0) {
      this.hideTooltip();
      return;
    }
    
    let nearest = null;
    let minDist = Infinity;
    
    points.forEach(point => {
      const dx = (point.x - x) / (this.xScale.max - this.xScale.min);
      const dy = (point.y - y) / (this.yScale.max - this.yScale.min);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDist && dist < 0.02) { // threshold
        minDist = dist;
        nearest = point;
      }
    });
    
    if (nearest) {
      this.showTooltip(mouseX, mouseY, nearest);
    } else {
      this.hideTooltip();
    }
  }
  
  /**
   * Show tooltip
   */
  showTooltip(x, y, point) {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'chart-tooltip';
      this.container.appendChild(this.tooltip);
    }
    
    const { notation } = this.props;
    this.tooltip.innerHTML = `
      <div>x: ${formatWithNotation(point.x, notation)}</div>
      <div>y: ${formatWithNotation(point.y, notation)}</div>
    `;
    
    this.tooltip.style.left = `${x + 10}px`;
    this.tooltip.style.top = `${y - 30}px`;
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
   * Reset view
   */
  resetView() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    
    const points = this.getDataPoints();
    if (points.length > 0) {
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      
      this.xScale = {
        min: Math.min(...xValues),
        max: Math.max(...xValues)
      };
      this.yScale = {
        min: Math.min(...yValues),
        max: Math.max(...yValues)
      };
      
      // Add 5% padding
      const xPadding = (this.xScale.max - this.xScale.min) * 0.05;
      const yPadding = (this.yScale.max - this.yScale.min) * 0.05;
      
      this.xScale.min -= xPadding;
      this.xScale.max += xPadding;
      this.yScale.min -= yPadding;
      this.yScale.max += yPadding;
    }
  }
  
  /**
   * Get data points array
   */
  getDataPoints() {
    const { data } = this.props;
    if (!data) return [];
    
    if (data.x && data.y && Array.isArray(data.x) && Array.isArray(data.y)) {
      return data.x.map((x, i) => ({ x, y: data.y[i] }));
    }
    
    if (Array.isArray(data.data)) {
      return data.data.map(([x, y]) => ({ x, y }));
    }
    
    return [];
  }
  
  /**
   * Screen to data coordinate conversion
   */
  screenToDataX(screenX) {
    const chartX = screenX - MARGIN.left;
    const ratio = chartX / this.chartWidth;
    const xRange = (this.xScale.max - this.xScale.min) / this.zoom;
    return this.xScale.min + this.pan.x + ratio * xRange;
  }
  
  screenToDataY(screenY) {
    const chartY = screenY - MARGIN.top;
    const ratio = 1 - (chartY / this.chartHeight);
    const yRange = (this.yScale.max - this.yScale.min) / this.zoom;
    return this.yScale.min + this.pan.y + ratio * yRange;
  }
  
  /**
   * Data to screen coordinate conversion
   */
  dataToScreenX(dataX) {
    const xRange = (this.xScale.max - this.xScale.min) / this.zoom;
    const ratio = (dataX - this.xScale.min - this.pan.x) / xRange;
    return MARGIN.left + ratio * this.chartWidth;
  }
  
  dataToScreenY(dataY) {
    const yRange = (this.yScale.max - this.yScale.min) / this.zoom;
    const ratio = (dataY - this.yScale.min - this.pan.y) / yRange;
    return MARGIN.top + this.chartHeight - ratio * this.chartHeight;
  }
  
  /**
   * Notify parent of view change
   */
  notifyViewChange() {
    if (this.debouncedViewChange) {
      const xMin = this.screenToDataX(MARGIN.left);
      const xMax = this.screenToDataX(MARGIN.left + this.chartWidth);
      const yMin = this.screenToDataY(MARGIN.top + this.chartHeight);
      const yMax = this.screenToDataY(MARGIN.top);
      
      this.debouncedViewChange({
        x: [xMin, xMax],
        y: [yMin, yMax],
        zoom: this.zoom
      });
    }
  }
  
  /**
   * Update dimensions
   */
  updateDimensions() {
    if (!this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    this.svgWidth = rect.width;
    this.svgHeight = Math.max(400, Math.min(600, rect.width * 0.6));
    this.chartWidth = this.svgWidth - MARGIN.left - MARGIN.right;
    this.chartHeight = this.svgHeight - MARGIN.top - MARGIN.bottom;
    
    this.renderChart();
  }
  
  /**
   * Render chart
   */
  renderChart() {
    if (!this.svgElement || !this.chartGroup) return;
    
    // Clear chart
    this.chartGroup.innerHTML = '';
    
    const { showGrid, aspect } = this.props;
    const points = this.getDataPoints();
    
    if (points.length === 0) return;
    
    // Render grid
    if (showGrid) {
      this.renderGrid();
    }
    
    // Render line and/or points
    const visiblePoints = points.filter(p => {
      const x = this.dataToScreenX(p.x);
      const y = this.dataToScreenY(p.y);
      return x >= MARGIN.left && x <= this.svgWidth - MARGIN.right &&
             y >= MARGIN.top && y <= this.svgHeight - MARGIN.bottom;
    });
    
    if (aspect === 'line' || aspect === 'both') {
      this.renderLine(visiblePoints);
    }
    
    if (aspect === 'point' || aspect === 'both') {
      this.renderPoints(visiblePoints);
    }
    
    // Render axes
    this.renderAxes();
  }
  
  /**
   * Render grid
   */
  renderGrid() {
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.setAttribute('class', 'line-grid');
    
    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      const x = MARGIN.left + (i / 10) * this.chartWidth;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', MARGIN.top);
      line.setAttribute('x2', x);
      line.setAttribute('y2', this.svgHeight - MARGIN.bottom);
      gridGroup.appendChild(line);
    }
    
    // Horizontal lines
    for (let i = 0; i <= 10; i++) {
      const y = MARGIN.top + (i / 10) * this.chartHeight;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', MARGIN.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', this.svgWidth - MARGIN.right);
      line.setAttribute('y2', y);
      gridGroup.appendChild(line);
    }
    
    this.chartGroup.appendChild(gridGroup);
  }
  
  /**
   * Render line
   */
  renderLine(points) {
    if (points.length < 2) return;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'line-path');
    
    const d = points.map((p, i) => {
      const x = this.dataToScreenX(p.x);
      const y = this.dataToScreenY(p.y);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    path.setAttribute('d', d);
    this.chartGroup.appendChild(path);
  }
  
  /**
   * Render points
   */
  renderPoints(points) {
    const pointGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pointGroup.setAttribute('class', 'line-points');
    
    points.forEach(p => {
      const x = this.dataToScreenX(p.x);
      const y = this.dataToScreenY(p.y);
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', 3);
      pointGroup.appendChild(circle);
    });
    
    this.chartGroup.appendChild(pointGroup);
  }
  
  /**
   * Render axes
   */
  renderAxes() {
    const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // X axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('class', 'line-axis');
    xAxis.setAttribute('x1', MARGIN.left);
    xAxis.setAttribute('y1', this.svgHeight - MARGIN.bottom);
    xAxis.setAttribute('x2', this.svgWidth - MARGIN.right);
    xAxis.setAttribute('y2', this.svgHeight - MARGIN.bottom);
    axisGroup.appendChild(xAxis);
    
    // Y axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('class', 'line-axis');
    yAxis.setAttribute('x1', MARGIN.left);
    yAxis.setAttribute('y1', MARGIN.top);
    yAxis.setAttribute('x2', MARGIN.left);
    yAxis.setAttribute('y2', this.svgHeight - MARGIN.bottom);
    axisGroup.appendChild(yAxis);
    
    this.chartGroup.appendChild(axisGroup);
  }
  
  /**
   * Render component
   */
  render() {
    this.clearListeners();
    const { loading, error } = this.props;
    
    if (loading) {
      this.container.innerHTML = `
        <div class="chart-state">
          <div class="loading-spinner"></div>
          <div class="state-text">Loading chart...</div>
        </div>
      `;
      return;
    }
    
    if (error) {
      this.container.innerHTML = `
        <div class="chart-state error">
          <div class="state-text error-text">${error}</div>
        </div>
      `;
      return;
    }
    
    const points = this.getDataPoints();
    if (points.length === 0) {
      this.container.innerHTML = `
        <div class="chart-state">
          <div class="state-text">No data to display</div>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = `
      <div class="line-chart">
        <svg class="line-svg" width="${this.svgWidth || 800}" height="${this.svgHeight || 400}">
          <g class="chart-group"></g>
        </svg>
      </div>
    `;
    
    // Get refs
    this.svgElement = this.container.querySelector('.line-svg');
    this.chartGroup = this.container.querySelector('.chart-group');
    
    this.updateDimensions();
    this.setupEventListeners();
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
    
    super.destroy();
  }
}

export default LineChart;
