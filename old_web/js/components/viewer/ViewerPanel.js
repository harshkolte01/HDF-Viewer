import Component from '../Component.js';
import VirtualMatrix from '../../visualizations/VirtualMatrix.js';
import LineChart from '../../visualizations/LineChart.js';
import Heatmap from '../../visualizations/Heatmap.js';

/**
 * Format value for display
 */
function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(' x ');
  }
  if (value === null || value === undefined) {
    return '--';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Format number with notation
 */
function formatNumber(value, notation = 'auto') {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '--';
  }

  if (notation === 'exact') {
    return String(value);
  }

  if (notation === 'scientific') {
    return number.toExponential(4);
  }

  const abs = Math.abs(number);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) {
    return number.toExponential(3);
  }

  return number.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/**
 * Format table cell value
 */
function formatCell(value, notation) {
  if (value === null || value === undefined) {
    return '--';
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatCell(item, notation)).join(', ');
  }
  if (typeof value === 'number') {
    return formatNumber(value, notation);
  }
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return formatNumber(asNumber, notation);
    }
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Format type description from type info
 */
function formatTypeDescription(typeInfo) {
  if (!typeInfo || typeof typeInfo === 'string') {
    return typeInfo || 'Unknown';
  }

  const parts = [];

  if (typeInfo.class) {
    parts.push(typeInfo.class);
  }

  if (typeInfo.signed !== undefined) {
    parts.push(typeInfo.signed ? 'signed' : 'unsigned');
  }

  if (typeInfo.size) {
    parts.push(`${typeInfo.size}-bit`);
  }

  if (typeInfo.endianness) {
    parts.push(typeInfo.endianness);
  }

  return parts.join(', ');
}

/**
 * Render preview table (1D or 2D)
 */
function renderTable(preview, notation) {
  if (!preview?.table) {
    return `
      <div class="panel-state">
        <div class="state-text">Table preview not available.</div>
      </div>
    `;
  }

  if (preview.table.kind === '1d') {
    const rows = preview.table.values.map((value, index) => `
      <tr>
        <td>${index}</td>
        <td>${formatCell(value, notation)}</td>
      </tr>
    `).join('');

    return `
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  if (preview.table.kind === '2d') {
    const data = preview.table.data || [];
    const cols = data[0]?.length || 0;
    
    const headerCells = Array.from({ length: cols }, (_, idx) => `<th>${idx}</th>`).join('');
    
    const rows = data.map((row, rowIndex) => {
      const cells = row.map((cell, cellIndex) => 
        `<td>${formatCell(cell, notation)}</td>`
      ).join('');
      return `
        <tr>
          <td class="row-index">${rowIndex}</td>
          ${cells}
        </tr>
      `;
    }).join('');

    return `
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th></th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="panel-state">
      <div class="state-text">Table preview not available.</div>
    </div>
  `;
}

function is2DArray(value) {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
}

function adaptLinePayload(lineData) {
  if (!lineData) return null;

  if (Array.isArray(lineData?.x) && Array.isArray(lineData?.y)) {
    return { x: lineData.x, y: lineData.y };
  }

  if (Array.isArray(lineData?.data)) {
    const values = lineData.data;
    if (values.length > 0 && Array.isArray(values[0])) {
      return { data: values };
    }

    const step = Number(lineData?.downsample_info?.step) || 1;
    const offset = Number.isFinite(Number(lineData?.line_offset))
      ? Number(lineData.line_offset)
      : 0;

    return {
      x: values.map((_, idx) => offset + idx * step),
      y: values
    };
  }

  return null;
}

function resolveLineChartData(preview, lineData) {
  const fullData = adaptLinePayload(lineData);
  if (fullData) return fullData;

  if (preview?.plot?.type === 'line') {
    const previewPlot = adaptLinePayload(preview.plot);
    if (previewPlot) return previewPlot;
  }

  if (Array.isArray(preview?.profile?.x) && Array.isArray(preview?.profile?.y)) {
    return {
      x: preview.profile.x,
      y: preview.profile.y
    };
  }

  if (preview?.table?.kind === '1d' && Array.isArray(preview.table.values)) {
    return {
      x: preview.table.values.map((_, idx) => idx),
      y: preview.table.values
    };
  }

  return null;
}

function adaptHeatmapPayload(heatmapPayload, preview) {
  let values = null;

  if (is2DArray(heatmapPayload?.values)) {
    values = heatmapPayload.values;
  } else if (is2DArray(heatmapPayload?.data)) {
    values = heatmapPayload.data;
  } else if (is2DArray(preview?.plot?.data)) {
    values = preview.plot.data;
  } else if (is2DArray(preview?.table?.data)) {
    values = preview.table.data;
  }

  if (!values) return null;

  const rows = values.length;
  const cols = Array.isArray(values[0]) ? values[0].length : 0;

  let min = Number.isFinite(Number(heatmapPayload?.vmin)) ? Number(heatmapPayload.vmin) : Infinity;
  let max = Number.isFinite(Number(heatmapPayload?.vmax)) ? Number(heatmapPayload.vmax) : -Infinity;

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = Infinity;
    max = -Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const value = Number(values[r]?.[c]);
        if (!Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
  }

  return {
    values,
    rows,
    cols,
    vmin: min,
    vmax: max,
    max_size_clamped: Boolean(heatmapPayload?.max_size_clamped),
    effective_max_size: heatmapPayload?.effective_max_size ?? rows * cols
  };
}

/**
 * ViewerPanel Component
 * Displays either metadata (inspect mode) or data preview (display mode)
 */
export default class ViewerPanel extends Component {
  constructor(container, props) {
    super(container);
    this.props = props;
    
    // Child component refs
    this.virtualMatrix = null;
    this.lineChart = null;
    this.heatmap = null;
    
    this.render();
  }

  /**
   * Update props from parent
   */
  updateProps(props) {
    this.props = props;
    this.render();
  }

  destroyVisualizations() {
    if (this.virtualMatrix) {
      this.virtualMatrix.destroy();
      this.virtualMatrix = null;
    }

    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }

    if (this.heatmap) {
      this.heatmap.destroy();
      this.heatmap = null;
    }
  }

  /**
   * Render metadata section (inspect mode)
   */
  renderMetadata() {
    const { meta, loading, error } = this.props;
    
    if (loading) {
      return `
        <div class="panel-state">
          <div class="loading-spinner"></div>
          <div class="state-text">Loading metadata...</div>
        </div>
      `;
    }

    if (error && !loading) {
      return `
        <div class="panel-state error">
          <div class="state-text error-text">${error}</div>
        </div>
      `;
    }

    if (!meta) {
      return `
        <div class="panel-state">
          <div class="state-text">Select an item from the tree to view its metadata.</div>
        </div>
      `;
    }

    const isDataset = meta.kind === 'dataset';
    const isGroup = meta.kind === 'group';

    // Build metadata rows
    let html = '<div class="metadata-simple">';

    // Basic info
    html += `
      <div class="info-row">
        <span class="info-label">Name</span>
        <span class="info-value">${meta.name || '(root)'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Path</span>
        <span class="info-value mono">${meta.path}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Kind</span>
        <span class="info-value">${meta.kind}</span>
      </div>
    `;

    // Group info
    if (isGroup && meta.num_children !== undefined) {
      html += `
        <div class="info-row">
          <span class="info-label">Children</span>
          <span class="info-value">${meta.num_children}</span>
        </div>
      `;
    }

    // Dataset type info
    if (isDataset && meta.type && typeof meta.type === 'object') {
      html += `
        <div class="info-row">
          <span class="info-label">Type</span>
          <span class="info-value">${formatTypeDescription(meta.type)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Class</span>
          <span class="info-value">${meta.type.class || '--'}</span>
        </div>
      `;

      if (meta.type.signed !== undefined) {
        html += `
          <div class="info-row">
            <span class="info-label">Signed</span>
            <span class="info-value">${meta.type.signed ? 'Yes' : 'No'}</span>
          </div>
        `;
      }

      if (meta.type.endianness) {
        html += `
          <div class="info-row">
            <span class="info-label">Endianness</span>
            <span class="info-value">${meta.type.endianness}</span>
          </div>
        `;
      }

      if (meta.type.size) {
        html += `
          <div class="info-row">
            <span class="info-label">Size</span>
            <span class="info-value">${meta.type.size} bits</span>
          </div>
        `;
      }
    }

    // Dataset shape info
    if (isDataset) {
      if (meta.shape) {
        html += `
          <div class="info-row">
            <span class="info-label">Shape</span>
            <span class="info-value mono">[${formatValue(meta.shape)}]</span>
          </div>
        `;
      }

      if (meta.ndim !== undefined) {
        html += `
          <div class="info-row">
            <span class="info-label">Dimensions</span>
            <span class="info-value">${meta.ndim}D</span>
          </div>
        `;
      }

      if (meta.size !== undefined) {
        html += `
          <div class="info-row">
            <span class="info-label">Total Elements</span>
            <span class="info-value">${meta.size.toLocaleString()}</span>
          </div>
        `;
      }

      if (meta.dtype) {
        html += `
          <div class="info-row">
            <span class="info-label">DType</span>
            <span class="info-value mono">${meta.dtype}</span>
          </div>
        `;
      }

      if (meta.chunks) {
        html += `
          <div class="info-row">
            <span class="info-label">Chunks</span>
            <span class="info-value mono">[${formatValue(meta.chunks)}]</span>
          </div>
        `;
      }
    }

    // Compression info
    if (isDataset && meta.compression) {
      const compressionText = meta.compression + 
        (meta.compression_opts ? ` (level ${meta.compression_opts})` : '');
      html += `
        <div class="info-row">
          <span class="info-label">Compression</span>
          <span class="info-value">${compressionText}</span>
        </div>
      `;
    }

    // Filters info
    if (isDataset && meta.filters && meta.filters.length > 0) {
      const filterText = meta.filters.map(f => 
        f.name + (f.level ? ` (${f.level})` : '')
      ).join(', ');
      html += `
        <div class="info-row">
          <span class="info-label">Filters</span>
          <span class="info-value">${filterText}</span>
        </div>
      `;
    }

    // Raw type info
    if (isDataset && meta.rawType) {
      html += `
        <div class="info-row">
          <span class="info-label">Type Number</span>
          <span class="info-value mono">${meta.rawType.type}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Size (bytes)</span>
          <span class="info-value">${meta.rawType.size}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Little Endian</span>
          <span class="info-value">${meta.rawType.littleEndian ? 'Yes' : 'No'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Variable Length</span>
          <span class="info-value">${meta.rawType.vlen ? 'Yes' : 'No'}</span>
        </div>
      `;
    }

    // Attributes
    if (meta.attributes && meta.attributes.length > 0) {
      html += `<div class="info-section-title">Attributes (${meta.attributes.length})</div>`;
      meta.attributes.forEach(attr => {
        html += `
          <div class="info-row indent">
            <span class="info-label">${attr.name}</span>
            <span class="info-value mono">${formatValue(attr.value)}</span>
          </div>
        `;
      });
    }

    // Raw JSON
    html += `
      <div class="info-section-title">Raw JSON</div>
      <pre class="json-view">${JSON.stringify(meta, null, 2)}</pre>
    `;

    html += '</div>';
    return html;
  }

  /**
   * Render dimension controls sidebar (display mode, 2D+ data)
   */
  renderDimensionSidebar() {
    const {
      preview,
      displayDims,
      stagedDisplayDims,
      stagedFixedIndices,
      activeTab
    } = this.props;

    if (!preview || preview.ndim < 2) {
      return '';
    }

    const isLineTab = activeTab === 'line';
    const appliedDisplayDims = Array.isArray(displayDims) && displayDims.length === 2
      ? displayDims
      : (Array.isArray(preview.display_dims) ? preview.display_dims : [0, 1]);
    const resolvedDisplayDims = Array.isArray(stagedDisplayDims) && stagedDisplayDims.length === 2
      ? stagedDisplayDims
      : appliedDisplayDims;

    const displayDimsLabel = appliedDisplayDims.length === 2
      ? `D${appliedDisplayDims[0]} x D${appliedDisplayDims[1]}`
      : 'Auto';

    const hasPendingDims = appliedDisplayDims.length === 2
      && resolvedDisplayDims.length === 2
      && (appliedDisplayDims[0] !== resolvedDisplayDims[0]
        || appliedDisplayDims[1] !== resolvedDisplayDims[1]);

    const yDim = resolvedDisplayDims[0];
    const xDim = resolvedDisplayDims[1];
    const dimOptions = preview.shape ? preview.shape.map((_, idx) => idx) : [];

    let html = '<aside class="preview-sidebar">';

    // Dimension summary
    html += `
      <div class="dimension-summary">
        <span class="dim-label">Display dims</span>
        <span class="dim-value">${displayDimsLabel}</span>
        ${hasPendingDims && preview.ndim > 2 ? `
          <span class="dim-pending">
            Pending: D${resolvedDisplayDims[0]} x D${resolvedDisplayDims[1]} (click Set)
          </span>
        ` : ''}
      </div>
    `;

    // 2D axis toggle
    if (preview.ndim === 2) {
      html += '<div class="axis-toggle">';
      
      // X axis
      html += `
        <div class="axis-row">
          <span class="axis-label">x</span>
          <div class="axis-options" data-axis="x">
            ${dimOptions.map(dim => `
              <button
                type="button"
                class="axis-btn ${xDim === dim ? 'active' : ''}"
                data-dim="${dim}"
              >
                D${dim}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      // Y axis (only for non-line tabs)
      if (!isLineTab) {
        html += `
          <div class="axis-row">
            <span class="axis-label">y</span>
            <div class="axis-options" data-axis="y">
              ${dimOptions.map(dim => `
                <button
                  type="button"
                  class="axis-btn ${yDim === dim ? 'active' : ''}"
                  data-dim="${dim}"
                >
                  D${dim}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      html += '</div>'; // axis-toggle
    }

    // 3D+ dropdown controls
    if (preview.ndim > 2) {
      html += '<div class="dimension-controls">';

      // Display dim A
      html += `
        <div class="dim-group">
          <label>Display dim A</label>
          <select class="dim-select" data-index="0">
            ${preview.shape.map((size, idx) => `
              <option value="${idx}" ${resolvedDisplayDims[0] === idx ? 'selected' : ''}>
                D${idx} (size ${size})
              </option>
            `).join('')}
          </select>
        </div>
      `;

      // Display dim B
      html += `
        <div class="dim-group">
          <label>Display dim B</label>
          <select class="dim-select" data-index="1">
            ${preview.shape.map((size, idx) => `
              <option value="${idx}" ${resolvedDisplayDims[1] === idx ? 'selected' : ''}>
                D${idx} (size ${size})
              </option>
            `).join('')}
          </select>
        </div>
      `;

      // Fixed index sliders
      html += '<div class="dim-sliders">';
      preview.shape.forEach((size, dim) => {
        if (resolvedDisplayDims.includes(dim)) return;
        const max = Math.max(0, size - 1);
        const current = stagedFixedIndices?.[dim] ?? Math.floor(size / 2);
        html += `
          <div class="dim-slider" data-dim="${dim}" data-size="${size}">
            <label>Dim ${dim} index</label>
            <div class="slider-row">
              <input
                type="range"
                class="dim-range"
                min="0"
                max="${max}"
                value="${current}"
                data-dim="${dim}"
              />
              <input
                type="number"
                class="dim-number"
                min="0"
                max="${max}"
                value="${current}"
                data-dim="${dim}"
              />
            </div>
          </div>
        `;
      });
      html += '</div>'; // dim-sliders

      // Set/Reset buttons
      html += `
        <div class="dim-controls-buttons">
          <button type="button" class="dim-set-btn" ${!preview ? 'disabled' : ''}>
            Set
          </button>
          <button type="button" class="dim-reset-btn" ${!preview ? 'disabled' : ''}>
            Reset
          </button>
        </div>
      `;

      html += '</div>'; // dimension-controls
    }

    html += '</aside>';
    return html;
  }

  /**
   * Render display content (table/line/heatmap tabs)
   */
  renderDisplayContent() {
    const {
      preview,
      previewLoading,
      previewError,
      activeTab,
      notation,
      matrixEnabled,
      matrixLoading,
      matrixError,
      matrixShape,
      lineLoading,
      lineError,
      heatmapLoading,
      heatmapError,
      heatmapData,
      selectedPath
    } = this.props;

    const hasSelection = selectedPath && selectedPath !== '/';

    if (!hasSelection) {
      return `
        <div class="panel-state">
          <div class="state-text">
            Select a dataset from the tree to view a preview.
          </div>
        </div>
      `;
    }

    if (previewLoading) {
      return `
        <div class="panel-state">
          <div class="loading-spinner"></div>
          <div class="state-text">Loading preview...</div>
        </div>
      `;
    }

    if (previewError && !previewLoading) {
      return `
        <div class="panel-state error">
          <div class="state-text error-text">${previewError}</div>
        </div>
      `;
    }

    if (!preview) {
      return `
        <div class="panel-state">
          <div class="state-text">No preview data available for the selected item.</div>
        </div>
      `;
    }

    const isLineTab = activeTab === 'line';

    let html = `
      <div class="preview-shell">
        <div class="preview-layout ${isLineTab ? 'is-line' : ''}">
    `;

    // Dimension sidebar (2D+ data)
    html += this.renderDimensionSidebar();

    // Content area
    html += '<div class="preview-content">';

    // Table tab
    if (activeTab === 'table') {
      html += '<div class="data-section">';
      html += `
        <div class="data-actions">
          <button
            type="button"
            class="data-btn"
            data-action="enable-matrix"
            ${!matrixShape || matrixLoading ? 'disabled' : ''}
          >
            Load full view
          </button>
          ${matrixLoading ? '<span class="data-status">Loading blocks...</span>' : ''}
          ${matrixError ? `<span class="data-status error">${matrixError}</span>` : ''}
        </div>
      `;

      if (matrixEnabled && matrixShape) {
        html += '<div class="matrix-container"></div>';
      } else {
        html += renderTable(preview, notation);
      }

      html += '</div>'; // data-section
    }

    // Line tab
    if (activeTab === 'line') {
      html += '<div class="data-section">';
      html += `
        <div class="data-actions">
          <button
            type="button"
            class="data-btn"
            data-action="enable-line"
            ${lineLoading ? 'disabled' : ''}
          >
            Load full line
          </button>
          ${lineLoading ? '<span class="data-status">Loading line data...</span>' : ''}
          ${lineError ? `<span class="data-status error">${lineError}</span>` : ''}
        </div>
        <div class="line-container"></div>
      `;

      html += '</div>'; // data-section
    }

    // Heatmap tab
    if (activeTab === 'heatmap') {
      const canShowHeatmap = preview.ndim >= 2;
      if (canShowHeatmap) {
        html += '<div class="data-section">';
        html += `
          <div class="data-actions">
            <button
              type="button"
              class="data-btn"
              data-action="enable-heatmap"
              ${heatmapLoading ? 'disabled' : ''}
            >
              Load high-res
            </button>
            ${heatmapLoading ? '<span class="data-status">Loading heatmap...</span>' : ''}
            ${heatmapError ? `<span class="data-status error">${heatmapError}</span>` : ''}
            ${heatmapData?.max_size_clamped ? `<span class="data-status info">Clamped to ${heatmapData.effective_max_size} for response limits.</span>` : ''}
          </div>
          <div class="heatmap-container"></div>
        `;

        html += '</div>'; // data-section
      }
    }

    html += '</div>'; // preview-content
    html += '</div>'; // preview-layout
    html += '</div>'; // preview-shell

    return html;
  }

  /**
   * Handle axis button click (2D data)
   */
  handleAxisChange(axis, dim) {
    const { preview, onDisplayDimsChange, stagedDisplayDims, displayDims } = this.props;
    if (!preview?.shape || !onDisplayDimsChange) return;

    const appliedDisplayDims = Array.isArray(displayDims) && displayDims.length === 2
      ? displayDims
      : (Array.isArray(preview.display_dims) ? preview.display_dims : [0, 1]);
    const resolvedDisplayDims = Array.isArray(stagedDisplayDims) && stagedDisplayDims.length === 2
      ? stagedDisplayDims
      : appliedDisplayDims;

    const nextDims = [...resolvedDisplayDims];
    if (axis === 'x') {
      nextDims[1] = dim;
    } else {
      nextDims[0] = dim;
    }

    // Ensure both dimensions are different
    if (nextDims[0] === nextDims[1]) {
      nextDims[axis === 'x' ? 0 : 1] = dim === 0 ? 1 : 0;
    }

    onDisplayDimsChange(nextDims, preview.shape);
  }

  /**
   * Handle dimension select change (3D+ data)
   */
  handleDimSelectChange(index, value) {
    const { preview, onDisplayDimsChange, stagedDisplayDims, displayDims } = this.props;
    if (!preview?.shape || !onDisplayDimsChange) return;

    const appliedDisplayDims = Array.isArray(displayDims) && displayDims.length === 2
      ? displayDims
      : (Array.isArray(preview.display_dims) ? preview.display_dims : [0, 1]);
    const resolvedDisplayDims = Array.isArray(stagedDisplayDims) && stagedDisplayDims.length === 2
      ? stagedDisplayDims
      : appliedDisplayDims;

    const nextDims = [...resolvedDisplayDims];
    nextDims[index] = value;

    // Ensure both dimensions are different
    if (nextDims[0] === nextDims[1]) {
      nextDims[index === 0 ? 1 : 0] = value === 0 ? 1 : 0;
    }

    onDisplayDimsChange(nextDims, preview.shape);
  }

  /**
   * Handle fixed index change
   */
  handleFixedIndexChange(dim, value) {
    const { onFixedIndexChange, preview } = this.props;
    if (!onFixedIndexChange || !preview?.shape) return;

    const size = preview.shape[dim];
    onFixedIndexChange(dim, value, size);
  }

  /**
   * Render the component
   */
  render() {
    this.clearListeners();
    this.destroyVisualizations();

    const {
      viewMode,
      activeTab,
      matrixEnabled,
      matrixShape,
      matrixLoading,
      matrixError,
      notation
    } = this.props;

    const isInspect = viewMode === 'inspect';
    const isDisplay = viewMode === 'display';

    let html = `<div class="viewer-panel ${isInspect ? 'is-inspect' : ''} ${isDisplay ? 'is-display' : ''}">`;
    html += '<div class="panel-canvas">';

    if (isInspect) {
      html += this.renderMetadata();
    } else if (isDisplay) {
      html += this.renderDisplayContent();
    }

    html += '</div>'; // panel-canvas
    html += '</div>'; // viewer-panel

    this.container.innerHTML = html;

    // Instantiate VirtualMatrix if matrix is enabled
    if (isDisplay && activeTab === 'table' && matrixEnabled && matrixShape) {
      const matrixContainer = this.container.querySelector('.matrix-container');
      if (matrixContainer) {
        this.virtualMatrix = new VirtualMatrix(matrixContainer, {
          shape: matrixShape,
          blockSize: this.props.matrixBlockSize,
          notation,
          version: this.props.matrixVersion,
          getBlock: this.props.getMatrixBlock,
          onRequestBlock: this.props.onRequestMatrixBlock,
          loading: matrixLoading,
          error: matrixError
        });
      }
    }
    
    // Instantiate LineChart if line is enabled
    if (isDisplay && activeTab === 'line') {
      const lineContainer = this.container.querySelector('.line-container');
      if (lineContainer) {
        const lineChartData = resolveLineChartData(this.props.preview, this.props.lineData);
        this.lineChart = new LineChart(lineContainer, {
          data: lineChartData,
          aspect: this.props.lineAspect || 'line',
          showGrid: this.props.lineGrid !== false,
          loading: Boolean(this.props.lineLoading) && !lineChartData,
          error: lineChartData ? null : this.props.lineError,
          notation,
          onViewChange: this.props.onLineViewChange
        });
      }
    }
    
    // Instantiate Heatmap if heatmap is enabled
    if (isDisplay && activeTab === 'heatmap') {
      const heatmapContainer = this.container.querySelector('.heatmap-container');
      if (heatmapContainer) {
        const heatmapData = adaptHeatmapPayload(this.props.heatmapData, this.props.preview);
        this.heatmap = new Heatmap(heatmapContainer, {
          data: heatmapData,
          colormap: this.props.heatmapColormap || 'viridis',
          showGrid: this.props.heatmapGrid !== false,
          loading: Boolean(this.props.heatmapLoading) && !heatmapData,
          error: heatmapData ? null : this.props.heatmapError,
          notation,
          onZoomChange: this.props.onHeatmapZoom
        });
      }
    }
    
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const {
      onApplyDimensions,
      onResetDimensions,
      onEnableMatrix,
      onEnableLine,
      onEnableHeatmap
    } = this.props;

    // Axis buttons (2D)
    this.on('click', '.axis-btn', (e, target) => {
      const axis = target.closest('.axis-options')?.dataset.axis;
      const dim = Number(target.dataset.dim);
      if (axis && Number.isFinite(dim)) {
        this.handleAxisChange(axis, dim);
      }
    });

    // Dimension selects (3D+)
    this.on('change', '.dim-select', (e, target) => {
      const index = Number(target.dataset.index);
      const value = Number(target.value);
      if (Number.isFinite(index) && Number.isFinite(value)) {
        this.handleDimSelectChange(index, value);
      }
    });

    // Fixed index range sliders
    this.on('input', '.dim-range', (e, target) => {
      const dim = Number(target.dataset.dim);
      const value = Number(target.value);
      if (Number.isFinite(dim) && Number.isFinite(value)) {
        this.handleFixedIndexChange(dim, value);
        // Update the corresponding number input
        const numberInput = target.parentElement.querySelector('.dim-number');
        if (numberInput) numberInput.value = value;
      }
    });

    // Fixed index number inputs
    this.on('input', '.dim-number', (e, target) => {
      const dim = Number(target.dataset.dim);
      const value = Number(target.value);
      if (Number.isFinite(dim) && Number.isFinite(value)) {
        this.handleFixedIndexChange(dim, value);
        // Update the corresponding range input
        const rangeInput = target.parentElement.querySelector('.dim-range');
        if (rangeInput) rangeInput.value = value;
      }
    });

    // Set button
    this.on('click', '.dim-set-btn', (e, target) => {
      if (onApplyDimensions) {
        onApplyDimensions();
      }
    });

    // Reset button
    this.on('click', '.dim-reset-btn', (e, target) => {
      if (onResetDimensions) {
        onResetDimensions();
      }
    });

    // Data action buttons
    this.on('click', '.data-btn', (e, target) => {
      const action = target.dataset.action;
      if (action === 'enable-matrix' && onEnableMatrix) {
        onEnableMatrix();
      } else if (action === 'enable-line' && onEnableLine) {
        onEnableLine();
      } else if (action === 'enable-heatmap' && onEnableHeatmap) {
        onEnableHeatmap();
      }
    });
  }
  
  /**
   * Cleanup
   */
  destroy() {
    this.destroyVisualizations();
    super.destroy();
  }
}
