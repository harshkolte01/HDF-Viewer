/**
 * PreviewToolbar Component
 * Tab navigation and display controls
 */

import { Component } from '../Component.js';

export class PreviewToolbar extends Component {
  constructor(container, props = {}) {
    super(container);
    
    this.props = {
      activeTab: 'table',
      showHeatmap: false,
      disabled: false,
      notation: 'auto',
      lineGrid: false,
      lineAspect: 'line',
      heatmapGrid: false,
      heatmapColormap: 'viridis',
      onTabChange: null,
      onNotationChange: null,
      onLineGridChange: null,
      onLineAspectChange: null,
      onHeatmapGridChange: null,
      onHeatmapColormapChange: null,
      onExport: null,
      ...props
    };

    this.render();
  }

  updateProps(newProps) {
    this.props = { ...this.props, ...newProps };
    this.render();
  }

  handleTabChange(tab) {
    if (this.props.disabled) return;
    if (this.props.onTabChange) {
      this.props.onTabChange(tab);
    }
  }

  handleNotationChange(value) {
    if (this.props.disabled) return;
    if (this.props.onNotationChange) {
      this.props.onNotationChange(value);
    }
  }

  handleLineGridToggle() {
    if (this.props.disabled) return;
    if (this.props.onLineGridChange) {
      this.props.onLineGridChange(!this.props.lineGrid);
    }
  }

  handleLineAspectChange(value) {
    if (this.props.disabled) return;
    if (this.props.onLineAspectChange) {
      this.props.onLineAspectChange(value);
    }
  }

  handleHeatmapGridToggle() {
    if (this.props.disabled) return;
    if (this.props.onHeatmapGridChange) {
      this.props.onHeatmapGridChange(!this.props.heatmapGrid);
    }
  }

  handleHeatmapColormapChange(value) {
    if (this.props.disabled) return;
    if (this.props.onHeatmapColormapChange) {
      this.props.onHeatmapColormapChange(value);
    }
  }

  handleExport() {
    if (this.props.disabled) return;
    if (this.props.onExport) {
      this.props.onExport();
    }
  }

  renderTableControls() {
    const { notation, disabled } = this.props;
    return `
      <div class="subbar-actions">
        <div class="notation-group">
          <span class="notation-label">Notation</span>
          <div class="notation-tabs">
            ${['auto', 'scientific', 'exact'].map(value => `
              <button
                type="button"
                class="notation-tab ${notation === value ? 'active' : ''}"
                data-notation="${value}"
                ${disabled ? 'disabled' : ''}
              >
                ${value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderLineControls() {
    const { lineGrid, lineAspect, disabled } = this.props;
    return `
      <div class="subbar-actions">
        <button
          type="button"
          class="subbar-toggle line-grid-toggle ${lineGrid ? 'active' : ''}"
          ${disabled ? 'disabled' : ''}
        >
          Grid
        </button>
        <div class="aspect-group">
          <span class="aspect-label">Aspect</span>
          <div class="aspect-tabs">
            ${['line', 'point', 'both'].map(value => `
              <button
                type="button"
                class="aspect-tab ${lineAspect === value ? 'active' : ''}"
                data-aspect="${value}"
                ${disabled ? 'disabled' : ''}
              >
                ${value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
        <button
          type="button"
          class="subbar-export export-btn"
          ${disabled ? 'disabled' : ''}
        >
          Export
        </button>
      </div>
    `;
  }

  renderHeatmapControls() {
    const { heatmapGrid, heatmapColormap, disabled } = this.props;
    return `
      <div class="subbar-actions">
        <button
          type="button"
          class="subbar-toggle heatmap-grid-toggle ${heatmapGrid ? 'active' : ''}"
          ${disabled ? 'disabled' : ''}
        >
          Grid
        </button>
        <div class="colormap-group">
          <span class="colormap-label">Color</span>
          <div class="colormap-tabs">
            ${['viridis', 'plasma', 'inferno', 'magma', 'cool', 'hot'].map(value => `
              <button
                type="button"
                class="colormap-tab ${heatmapColormap === value ? 'active' : ''}"
                data-colormap="${value}"
                ${disabled ? 'disabled' : ''}
              >
                ${value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            `).join('')}
          </div>
        </div>
        <button
          type="button"
          class="subbar-export export-btn"
          ${disabled ? 'disabled' : ''}
        >
          Export
        </button>
      </div>
    `;
  }

  render() {
    this.clearListeners();
    const { activeTab, showHeatmap, disabled } = this.props;

    this.container.innerHTML = `
      <div class="viewer-subbar">
        <div class="subbar-tabs">
          <button
            type="button"
            class="subbar-tab ${activeTab === 'table' ? 'active' : ''}"
            data-tab="table"
            ${disabled ? 'disabled' : ''}
          >
            Matrix
          </button>
          <button
            type="button"
            class="subbar-tab ${activeTab === 'line' ? 'active' : ''}"
            data-tab="line"
            ${disabled ? 'disabled' : ''}
          >
            Line Graph
          </button>
          ${showHeatmap ? `
            <button
              type="button"
              class="subbar-tab ${activeTab === 'heatmap' ? 'active' : ''}"
              data-tab="heatmap"
              ${disabled ? 'disabled' : ''}
            >
              Heatmap
            </button>
          ` : ''}
        </div>
        ${activeTab === 'table' ? this.renderTableControls() : ''}
        ${activeTab === 'line' ? this.renderLineControls() : ''}
        ${activeTab === 'heatmap' ? this.renderHeatmapControls() : ''}
      </div>
    `;

    // Tab change events
    this.on('click', '[data-tab]', (e, target) => {
      const tab = target.dataset.tab;
      if (tab) this.handleTabChange(tab);
    });

    // Notation events
    this.on('click', '[data-notation]', (e, target) => {
      const notation = target.dataset.notation;
      if (notation) this.handleNotationChange(notation);
    });

    // Line controls
    this.on('click', '.line-grid-toggle', () => this.handleLineGridToggle());
    this.on('click', '[data-aspect]', (e, target) => {
      const aspect = target.dataset.aspect;
      if (aspect) this.handleLineAspectChange(aspect);
    });

    // Heatmap controls
    this.on('click', '.heatmap-grid-toggle', () => this.handleHeatmapGridToggle());
    this.on('click', '[data-colormap]', (e, target) => {
      const colormap = target.dataset.colormap;
      if (colormap) this.handleHeatmapColormapChange(colormap);
    });

    // Export button
    this.on('click', '.export-btn', () => this.handleExport());
  }
}

export default PreviewToolbar;
