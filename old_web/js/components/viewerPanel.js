import { getFileData } from "../api/hdf5Service.js";
import { escapeHtml } from "../utils/format.js";
import { LruCache } from "../utils/lru.js";

const MATRIX_ROW_HEIGHT = 28;
const MATRIX_COL_WIDTH = 96;
const MATRIX_HEADER_HEIGHT = 28;
const MATRIX_INDEX_WIDTH = 60;
const MATRIX_OVERSCAN = 4;
const MATRIX_BLOCK_CACHE = new LruCache(1600);
const MATRIX_PENDING = new Set();

function toSafeInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeShape(shape) {
  if (!Array.isArray(shape)) {
    return [];
  }

  return shape.map((size) => Math.max(0, toSafeInteger(size, 0)));
}

function getDefaultDisplayDims(shape) {
  return shape.length >= 2 ? [0, 1] : null;
}

function normalizeDisplayDims(displayDims, shape) {
  if (shape.length < 2) {
    return null;
  }

  if (!Array.isArray(displayDims) || displayDims.length !== 2) {
    return null;
  }

  const dims = displayDims.map((dim) => toSafeInteger(dim, null));
  if (dims.some((dim) => dim === null || dim < 0 || dim >= shape.length)) {
    return null;
  }

  if (dims[0] === dims[1]) {
    const fallback = Array.from({ length: shape.length }, (_, idx) => idx).find(
      (dim) => dim !== dims[0]
    );

    if (fallback === undefined) {
      return null;
    }

    dims[1] = fallback;
  }

  return dims;
}

function normalizeFixedIndices(fixedIndices, shape, displayDims = []) {
  const hidden = new Set(Array.isArray(displayDims) ? displayDims : []);
  const normalized = {};

  if (!fixedIndices || typeof fixedIndices !== "object") {
    return normalized;
  }

  Object.entries(fixedIndices).forEach(([dimKey, indexValue]) => {
    const dim = toSafeInteger(dimKey, null);
    const index = toSafeInteger(indexValue, null);

    if (
      dim === null ||
      index === null ||
      dim < 0 ||
      dim >= shape.length ||
      hidden.has(dim)
    ) {
      return;
    }

    const max = Math.max(0, shape[dim] - 1);
    normalized[dim] = clamp(index, 0, max);
  });

  return normalized;
}

function buildNextFixedIndices(currentIndices, displayDims, shape) {
  const dims = Array.isArray(displayDims) ? displayDims : [];
  const next = normalizeFixedIndices(currentIndices, shape, dims);
  const hidden = new Set(dims);

  shape.forEach((size, dim) => {
    if (hidden.has(dim)) {
      delete next[dim];
      return;
    }

    const max = Math.max(0, size - 1);
    const fallback = size > 0 ? Math.floor(size / 2) : 0;

    if (!Number.isFinite(next[dim])) {
      next[dim] = fallback;
      return;
    }

    next[dim] = clamp(toSafeInteger(next[dim], fallback), 0, max);
  });

  return next;
}

function areDimsEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

function areFixedIndicesEqual(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  const leftKeys = Object.keys(left).sort((x, y) => Number(x) - Number(y));
  const rightKeys = Object.keys(right).sort((x, y) => Number(x) - Number(y));

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key, index) => {
    const otherKey = rightKeys[index];
    return key === otherKey && Number(left[key]) === Number(right[key]);
  });
}

function buildDisplayDimsParam(displayDims) {
  if (!Array.isArray(displayDims) || displayDims.length !== 2) {
    return "";
  }

  return `${displayDims[0]},${displayDims[1]}`;
}

function buildFixedIndicesParam(fixedIndices) {
  if (!fixedIndices || typeof fixedIndices !== "object") {
    return "";
  }

  const entries = Object.entries(fixedIndices)
    .map(([dim, index]) => [toSafeInteger(dim, null), toSafeInteger(index, null)])
    .filter(([dim, index]) => dim !== null && index !== null)
    .sort(([a], [b]) => a - b);

  if (!entries.length) {
    return "";
  }

  return entries.map(([dim, index]) => `${dim}=${index}`).join(",");
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(" x ");
  }

  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatCell(value, notation = "auto") {
  if (value === null || value === undefined) {
    return "--";
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    if (notation === "exact") {
      return String(value);
    }

    if (notation === "scientific") {
      return asNumber.toExponential(4);
    }

    const abs = Math.abs(asNumber);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) {
      return asNumber.toExponential(3);
    }

    return asNumber.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  return String(value);
}

function formatTypeDescription(typeInfo) {
  if (!typeInfo || typeof typeInfo === "string") {
    return typeInfo || "Unknown";
  }

  const parts = [];
  if (typeInfo.class) parts.push(typeInfo.class);
  if (typeInfo.signed !== undefined) parts.push(typeInfo.signed ? "signed" : "unsigned");
  if (typeInfo.size) parts.push(`${typeInfo.size}-bit`);
  if (typeInfo.endianness) parts.push(typeInfo.endianness);

  return parts.join(", ");
}

function resolveDisplayControls(state, preview) {
  const shape = normalizeShape(preview?.shape);
  const config = state.displayConfig || {};

  const appliedDisplayDims =
    normalizeDisplayDims(config.displayDims, shape) ||
    normalizeDisplayDims(preview?.display_dims, shape) ||
    getDefaultDisplayDims(shape);
  const stagedDisplayDims =
    normalizeDisplayDims(config.stagedDisplayDims, shape) || appliedDisplayDims;

  const appliedFixedIndices = buildNextFixedIndices(
    normalizeFixedIndices(config.fixedIndices, shape, appliedDisplayDims || []),
    appliedDisplayDims || [],
    shape
  );

  const stagedBase =
    Object.keys(config.stagedFixedIndices || {}).length > 0
      ? config.stagedFixedIndices
      : appliedFixedIndices;
  const stagedFixedIndices = buildNextFixedIndices(
    normalizeFixedIndices(stagedBase, shape, stagedDisplayDims || []),
    stagedDisplayDims || [],
    shape
  );

  const hasPendingChanges =
    !areDimsEqual(stagedDisplayDims, appliedDisplayDims) ||
    !areFixedIndicesEqual(stagedFixedIndices, appliedFixedIndices);

  return {
    shape,
    appliedDisplayDims,
    appliedFixedIndices,
    stagedDisplayDims,
    stagedFixedIndices,
    hasPendingChanges,
  };
}

function renderTablePreview(preview, notation = "auto") {
  const table = preview?.table;
  if (!table || typeof table !== "object") {
    return '<div class="panel-state"><div class="state-text">Table preview not available.</div></div>';
  }

  const oneDValuesFromPlot = Array.isArray(preview?.plot?.y)
    ? preview.plot.y
    : Array.isArray(preview?.profile?.y)
    ? preview.profile.y
    : Array.isArray(preview?.data)
    ? preview.data
    : [];

  if (table.kind === "1d") {
    const values = Array.isArray(table.values)
      ? table.values
      : Array.isArray(table.data)
      ? table.data
      : oneDValuesFromPlot;
    if (!values.length) {
      return '<div class="panel-state"><div class="state-text">No 1D values available in preview response.</div></div>';
    }

    const rows = values.slice(0, 200).map((value, index) => {
      return `
        <tr>
          <td class="row-index">${index}</td>
          <td>${escapeHtml(formatCell(value, notation))}</td>
        </tr>
      `;
    });

    return `
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  const data = table.kind === "2d"
    ? (Array.isArray(table.data) ? table.data : [])
    : Array.isArray(preview?.plot?.data)
    ? preview.plot.data
    : (Array.isArray(preview?.data) ? preview.data : []);

  if (!data.length) {
    return '<div class="panel-state"><div class="state-text">No table rows available in preview response.</div></div>';
  }

  const rows = data.slice(0, 100).map((row, rowIndex) => {
    const cells = (Array.isArray(row) ? row : [row])
      .slice(0, 40)
      .map((value) => `<td>${escapeHtml(formatCell(value, notation))}</td>`)
      .join("");

    return `
      <tr>
        <td class="row-index">${rowIndex}</td>
        ${cells}
      </tr>
    `;
  });

  const firstRow = Array.isArray(data[0]) ? data[0] : [data[0]];
  const colCount = firstRow.length;
  const headCells = Array.from({ length: Math.min(colCount, 40) }, (_, index) => `<th>${index}</th>`).join("");

  return `
    <div class="preview-table-wrapper">
      <table class="preview-table">
        <thead>
          <tr>
            <th>#</th>
            ${headCells}
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function getLinePoints(preview) {
  const source = preview?.profile || preview?.plot || {};
  let yRaw = [];

  if (Array.isArray(source.y)) {
    yRaw = source.y;
  } else if (Array.isArray(source.values)) {
    yRaw = source.values;
  } else if (Array.isArray(source.data)) {
    yRaw = source.data;
  } else if (Array.isArray(preview?.table?.values)) {
    yRaw = preview.table.values;
  } else if (Array.isArray(preview?.table?.data)) {
    yRaw = Array.isArray(preview.table.data[0]) ? preview.table.data[0] : preview.table.data;
  } else if (Array.isArray(preview?.data)) {
    yRaw = preview.data;
  }

  if (!Array.isArray(yRaw) || !yRaw.length) {
    return [];
  }

  const xRaw = Array.isArray(source.x) && source.x.length === yRaw.length
    ? source.x
    : yRaw.map((_, index) => index);

  return yRaw
    .map((yValue, index) => ({
      x: Number(xRaw[index]),
      y: Number(yValue),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function renderLinePreview(preview) {
  const points = getLinePoints(preview);

  if (points.length < 2) {
    return '<div class="panel-state"><div class="state-text">No numeric line preview is available for this selection.</div></div>';
  }

  const width = 760;
  const height = 320;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const toChartPoint = (point) => {
    const x = padding + ((point.x - minX) / spanX) * chartWidth;
    const y = padding + chartHeight - ((point.y - minY) / spanY) * chartHeight;
    return { x, y };
  };

  const path = points
    .map((point, index) => {
      const chartPoint = toChartPoint(point);
      return `${index === 0 ? "M" : "L"}${chartPoint.x.toFixed(2)},${chartPoint.y.toFixed(2)}`;
    })
    .join(" ");

  const sampleStep = points.length > 120 ? Math.ceil(points.length / 120) : 1;
  const markers = points
    .filter((_, index) => index % sampleStep === 0)
    .map((point) => {
      const chartPoint = toChartPoint(point);
      return `<circle cx="${chartPoint.x.toFixed(2)}" cy="${chartPoint.y.toFixed(2)}" r="1.9"></circle>`;
    })
    .join("");

  const gridLines = Array.from({ length: 6 }, (_, idx) => {
    const ratio = idx / 5;
    const x = padding + ratio * chartWidth;
    const y = padding + ratio * chartHeight;
    return {
      vertical: `<line x1="${x}" y1="${padding}" x2="${x}" y2="${padding + chartHeight}"></line>`,
      horizontal: `<line x1="${padding}" y1="${y}" x2="${padding + chartWidth}" y2="${y}"></line>`,
    };
  });

  return `
    <div class="line-chart-shell">
      <div class="line-chart-toolbar">
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn active">Preview</button>
        </div>
        <div class="line-zoom-label">Points: ${points.length}</div>
      </div>
      <div class="line-chart-stage">
        <div class="line-chart-canvas">
          <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Line preview">
            <rect x="0" y="0" width="${width}" height="${height}" class="line-chart-bg"></rect>
            <g class="line-grid">${gridLines.map((line) => line.vertical + line.horizontal).join("")}</g>
            <g class="line-axis">
              <line x1="${padding}" y1="${padding + chartHeight}" x2="${padding + chartWidth}" y2="${padding + chartHeight}"></line>
              <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + chartHeight}"></line>
            </g>
            <g class="line-axis-labels">
              <text x="${padding}" y="${height - 8}">${escapeHtml(formatCell(minX))}</text>
              <text x="${padding + chartWidth - 80}" y="${height - 8}">${escapeHtml(formatCell(maxX))}</text>
              <text x="4" y="${padding + 10}">${escapeHtml(formatCell(maxY))}</text>
              <text x="4" y="${padding + chartHeight}">${escapeHtml(formatCell(minY))}</text>
            </g>
            <path class="line-path" d="${path}"></path>
            <g class="line-points">${markers}</g>
          </svg>
        </div>
      </div>
      <div class="line-stats">
        <span>min: ${escapeHtml(formatCell(minY))}</span>
        <span>max: ${escapeHtml(formatCell(maxY))}</span>
        <span>span: ${escapeHtml(formatCell(maxY - minY))}</span>
      </div>
    </div>
  `;
}

function getHeatmapRows(preview) {
  if (Array.isArray(preview?.plot?.data)) {
    return preview.plot.data;
  }

  if (Array.isArray(preview?.table?.data)) {
    return preview.table.data;
  }

  if (Array.isArray(preview?.data)) {
    return preview.data;
  }

  return [];
}

function getHeatColor(value, min, max) {
  if (!Number.isFinite(value)) {
    return "#F2F6FF";
  }

  const ratio = max <= min ? 0.5 : clamp((value - min) / (max - min), 0, 1);
  const start = [240, 249, 255];
  const end = [37, 99, 235];
  const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
  const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
  const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function renderHeatmapPreview(preview) {
  const rawRows = getHeatmapRows(preview)
    .filter((row) => Array.isArray(row))
    .slice(0, 20)
    .map((row) => row.slice(0, 20));

  if (!rawRows.length) {
    return '<div class="panel-state"><div class="state-text">No matrix preview is available for heatmap rendering.</div></div>';
  }

  const values = rawRows.flat().map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return '<div class="panel-state"><div class="state-text">Heatmap preview requires numeric values.</div></div>';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const colCount = rawRows[0]?.length || 0;

  const headerCells = Array.from({ length: colCount }, (_, index) => `<th>${index}</th>`).join("");
  const bodyRows = rawRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value) => {
          const numeric = Number(value);
          const background = getHeatColor(numeric, min, max);
          const textColor = Number.isFinite(numeric) && numeric > min + (max - min) * 0.55 ? "#FFFFFF" : "#0F172A";
          return `<td style="background:${background};color:${textColor}" title="${escapeHtml(String(value))}">${escapeHtml(
            formatCell(value)
          )}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="row-index">${rowIndex}</td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <div class="line-chart-shell heatmap-chart-shell">
      <div class="line-chart-toolbar">
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn active">Preview Grid</button>
        </div>
        <div class="line-zoom-label">min ${escapeHtml(formatCell(min))} / max ${escapeHtml(formatCell(max))}</div>
      </div>
      <div class="preview-table-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th>#</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDimensionControls(state, preview) {
  const ndim = Number(preview?.ndim || 0);
  if (ndim < 2) {
    return "";
  }

  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const appliedDims = controls.appliedDisplayDims || getDefaultDisplayDims(shape);
  const stagedDims = controls.stagedDisplayDims || appliedDims || [0, 1];
  const stagedFixed = controls.stagedFixedIndices || {};

  if (!appliedDims || !stagedDims) {
    return "";
  }

  const dimLabel = `D${appliedDims[0]} x D${appliedDims[1]}`;
  const pendingLabel = `D${stagedDims[0]} x D${stagedDims[1]}`;

  if (ndim === 2) {
    const xDim = stagedDims[1];
    const yDim = stagedDims[0];

    return `
      <aside class="preview-sidebar">
        <div class="dimension-summary">
          <span class="dim-label">Display dims</span>
          <span class="dim-value">${dimLabel}</span>
        </div>
        <div class="axis-toggle">
          <div class="axis-row">
            <span class="axis-label">x</span>
            <div class="axis-options">
              ${[0, 1]
                .map(
                  (dim) => `
                    <button
                      type="button"
                      class="axis-btn ${xDim === dim ? "active" : ""}"
                      data-axis-change="x"
                      data-axis-dim="${dim}"
                    >
                      D${dim}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="axis-row">
            <span class="axis-label">y</span>
            <div class="axis-options">
              ${[0, 1]
                .map(
                  (dim) => `
                    <button
                      type="button"
                      class="axis-btn ${yDim === dim ? "active" : ""}"
                      data-axis-change="y"
                      data-axis-dim="${dim}"
                    >
                      D${dim}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  const dimOptions = shape.map((size, idx) => ({ idx, size }));
  const xOptions = dimOptions;
  const yOptions = dimOptions.filter((option) => option.idx !== stagedDims[0]);
  const safeYDim = yOptions.some((option) => option.idx === stagedDims[1])
    ? stagedDims[1]
    : yOptions[0]?.idx;

  return `
    <aside class="preview-sidebar">
      <div class="dimension-summary">
        <span class="dim-label">Display dims</span>
        <span class="dim-value">${dimLabel}</span>
        ${
          controls.hasPendingChanges
            ? `<span class="dim-pending">Pending: ${pendingLabel} (click Set)</span>`
            : ""
        }
      </div>

      <div class="dimension-controls">
        <div class="dim-group">
          <label>Display dim A</label>
          <select data-display-dim-select="true" data-dim-index="0">
            ${xOptions
              .map(
                (option) => `
                  <option value="${option.idx}" ${stagedDims[0] === option.idx ? "selected" : ""}>
                    D${option.idx} (size ${option.size})
                  </option>
                `
              )
              .join("")}
          </select>
        </div>

        <div class="dim-group">
          <label>Display dim B</label>
          <select data-display-dim-select="true" data-dim-index="1">
            ${yOptions
              .map(
                (option) => `
                  <option value="${option.idx}" ${safeYDim === option.idx ? "selected" : ""}>
                    D${option.idx} (size ${option.size})
                  </option>
                `
              )
              .join("")}
          </select>
        </div>

        <div class="dim-sliders">
          ${shape
            .map((size, dim) => {
              if (stagedDims.includes(dim)) {
                return "";
              }

              const max = Math.max(0, size - 1);
              const current = Number.isFinite(stagedFixed[dim]) ? stagedFixed[dim] : Math.floor(size / 2);

              return `
                <div class="dim-slider">
                  <label>Dim ${dim} index</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="${max}"
                      value="${current}"
                      data-fixed-index-range="true"
                      data-fixed-dim="${dim}"
                      data-fixed-size="${size}"
                    />
                    <input
                      type="number"
                      min="0"
                      max="${max}"
                      value="${current}"
                      data-fixed-index-number="true"
                      data-fixed-dim="${dim}"
                      data-fixed-size="${size}"
                    />
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="dim-controls-buttons">
          <button type="button" class="dim-set-btn" data-dim-apply="true">Set</button>
          <button type="button" class="dim-reset-btn" data-dim-reset="true">Reset</button>
        </div>
      </div>
    </aside>
  `;
}

function buildMatrixSelectionKey(fileKey, path, displayDimsParam, fixedIndicesParam) {
  return [
    fileKey || "no-file",
    path || "/",
    displayDimsParam || "none",
    fixedIndicesParam || "none",
  ].join("|");
}

function buildMatrixBlockKey(selectionKey, rowOffset, colOffset, rowLimit, colLimit) {
  return `${selectionKey}|r${rowOffset}|c${colOffset}|rl${rowLimit}|cl${colLimit}|rs1|cs1`;
}

function resolveMatrixRuntimeConfig(state, preview) {
  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const displayDims = controls.appliedDisplayDims;
  const fixedIndices = controls.appliedFixedIndices || {};

  if (!Array.isArray(displayDims) || displayDims.length !== 2 || shape.length < 2) {
    return {
      supported: false,
      rows: 0,
      cols: 0,
      blockRows: 200,
      blockCols: 50,
      displayDimsParam: "",
      fixedIndicesParam: "",
      selectionKey: "",
    };
  }

  const rowDim = displayDims[0];
  const colDim = displayDims[1];
  const rows = Math.max(0, toSafeInteger(shape[rowDim], 0));
  const cols = Math.max(0, toSafeInteger(shape[colDim], 0));
  const blockRows = Math.max(1, Math.min(2000, toSafeInteger(state.matrixBlockSize?.rows, 200)));
  const blockCols = Math.max(1, Math.min(2000, toSafeInteger(state.matrixBlockSize?.cols, 50)));
  const displayDimsParam = buildDisplayDimsParam(displayDims);
  const fixedIndicesParam = buildFixedIndicesParam(fixedIndices);
  const selectionKey = buildMatrixSelectionKey(
    state.selectedFile,
    state.selectedPath,
    displayDimsParam,
    fixedIndicesParam
  );

  return {
    supported: true,
    rows,
    cols,
    blockRows,
    blockCols,
    displayDimsParam,
    fixedIndicesParam,
    selectionKey,
  };
}

function renderVirtualMatrixShell(state, config) {
  const totalWidth = MATRIX_INDEX_WIDTH + config.cols * MATRIX_COL_WIDTH;
  const totalHeight = MATRIX_HEADER_HEIGHT + config.rows * MATRIX_ROW_HEIGHT;

  return `
    <div
      class="matrix-table-shell"
      data-matrix-shell="true"
      data-matrix-rows="${config.rows}"
      data-matrix-cols="${config.cols}"
      data-matrix-block-rows="${config.blockRows}"
      data-matrix-block-cols="${config.blockCols}"
      data-matrix-file-key="${escapeHtml(state.selectedFile || "")}"
      data-matrix-path="${escapeHtml(state.selectedPath || "/")}"
      data-matrix-display-dims="${escapeHtml(config.displayDimsParam || "")}"
      data-matrix-fixed-indices="${escapeHtml(config.fixedIndicesParam || "")}"
      data-matrix-selection-key="${escapeHtml(config.selectionKey || "")}"
      data-matrix-notation="${escapeHtml(state.notation || "auto")}"
    >
      <div class="matrix-table" data-matrix-table="true">
        <div class="matrix-spacer" style="width:${totalWidth}px;height:${totalHeight}px;"></div>
        <div class="matrix-header" style="width:${totalWidth}px;height:${MATRIX_HEADER_HEIGHT}px;">
          <div class="matrix-header-corner" style="width:${MATRIX_INDEX_WIDTH}px;"></div>
          <div
            class="matrix-header-cells"
            data-matrix-header-cells="true"
            style="width:${config.cols * MATRIX_COL_WIDTH}px;height:${MATRIX_HEADER_HEIGHT}px;"
          ></div>
        </div>
        <div
          class="matrix-index"
          data-matrix-index="true"
          style="width:${MATRIX_INDEX_WIDTH}px;height:${config.rows * MATRIX_ROW_HEIGHT}px;"
        ></div>
        <div
          class="matrix-cells"
          data-matrix-cells="true"
          style="width:${config.cols * MATRIX_COL_WIDTH}px;height:${config.rows * MATRIX_ROW_HEIGHT}px;"
        ></div>
      </div>
    </div>
  `;
}

function renderMatrixSection(state, preview) {
  const config = resolveMatrixRuntimeConfig(state, preview);
  const canLoadFull = config.supported && config.rows > 0 && config.cols > 0;
  const isEnabled = state.matrixFullEnabled === true && canLoadFull;

  const statusText = !config.supported
    ? "Full matrix view requires at least 2 dimensions."
    : config.rows <= 0 || config.cols <= 0
    ? "No values available for the selected display dims."
    : isEnabled
    ? "Streaming blocks as you scroll."
    : "Preview mode. Click Load full view.";
  const statusTone = !config.supported || config.rows <= 0 || config.cols <= 0 ? "error" : "info";
  const statusClass = `data-status ${statusTone === "error" ? "error" : "info"}`;

  const content = isEnabled
    ? renderVirtualMatrixShell(state, config)
    : renderTablePreview(preview, state.notation || "auto");

  return `
    <div class="data-section">
      <div class="data-actions">
        <button
          type="button"
          class="data-btn"
          data-matrix-enable="true"
          ${!canLoadFull || isEnabled ? "disabled" : ""}
        >
          Load full view
        </button>
        <span class="${statusClass}" data-matrix-status="true">${escapeHtml(statusText)}</span>
      </div>
      ${content}
    </div>
  `;
}

function renderDisplayContent(state) {
  const hasSelection = state.selectedNodeType === "dataset" && state.selectedPath !== "/";
  const activeTab = state.displayTab || "table";
  const preview = state.preview;

  if (!hasSelection) {
    return `
      <div class="panel-state">
        <div class="state-text">Select a dataset from the tree to view a preview.</div>
      </div>
    `;
  }

  if (state.previewLoading) {
    return `
      <div class="panel-state">
        <div class="loading-spinner"></div>
        <div class="state-text">Loading preview...</div>
      </div>
    `;
  }

  if (state.previewError) {
    return `
      <div class="panel-state error">
        <div class="state-text error-text">${escapeHtml(state.previewError)}</div>
      </div>
    `;
  }

  if (!preview) {
    return `
      <div class="panel-state">
        <div class="state-text">No preview available yet.</div>
      </div>
    `;
  }

  let dataSection = renderMatrixSection(state, preview);
  if (activeTab === "line") {
    dataSection = `<div class="data-section">${renderLinePreview(preview)}</div>`;
  } else if (activeTab === "heatmap" && Number(preview.ndim || 0) >= 2) {
    dataSection = `<div class="data-section">${renderHeatmapPreview(preview)}</div>`;
  }

  return `
    <div class="preview-shell">
      <div class="preview-layout ${activeTab === "line" ? "is-line" : ""}">
        ${renderDimensionControls(state, preview)}
        <div class="preview-content">
          ${dataSection}
        </div>
      </div>
    </div>
  `;
}

function renderInspectContent(state) {
  const hasSelection = state.selectedPath !== "/";

  if (!hasSelection) {
    return `
      <div class="panel-state">
        <div class="state-text">Select an item from the tree to view its metadata.</div>
      </div>
    `;
  }

  if (state.metadataLoading) {
    return `
      <div class="panel-state">
        <div class="loading-spinner"></div>
        <div class="state-text">Loading metadata...</div>
      </div>
    `;
  }

  if (state.metadataError) {
    return `
      <div class="panel-state error">
        <div class="state-text error-text">${escapeHtml(state.metadataError)}</div>
      </div>
    `;
  }

  const meta = state.metadata;
  if (!meta) {
    return `
      <div class="panel-state">
        <div class="state-text">No metadata available.</div>
      </div>
    `;
  }

  const infoRows = [
    ["Name", meta.name || "(root)", false],
    ["Path", meta.path || state.selectedPath, true],
    ["Kind", meta.kind || state.selectedNodeType || "--", false],
  ];

  if (meta.num_children !== undefined) {
    infoRows.push(["Children", meta.num_children, false]);
  }

  if (meta.type) {
    infoRows.push(["Type", formatTypeDescription(meta.type), false]);
  }

  if (meta.shape) {
    infoRows.push(["Shape", `[${formatValue(meta.shape)}]`, true]);
  }

  if (meta.ndim !== undefined) {
    infoRows.push(["Dimensions", `${meta.ndim}D`, false]);
  }

  if (meta.size !== undefined) {
    infoRows.push(["Total Elements", Number(meta.size).toLocaleString(), false]);
  }

  if (meta.dtype) {
    infoRows.push(["DType", meta.dtype, true]);
  }

  if (meta.chunks) {
    infoRows.push(["Chunks", `[${formatValue(meta.chunks)}]`, true]);
  }

  if (meta.compression) {
    infoRows.push([
      "Compression",
      `${meta.compression}${meta.compression_opts ? ` (level ${meta.compression_opts})` : ""}`,
      false,
    ]);
  }

  return `
    <div class="metadata-simple">
      ${infoRows
        .map(
          ([label, value, mono]) => `
            <div class="info-row">
              <span class="info-label">${escapeHtml(String(label))}</span>
              <span class="info-value ${mono ? "mono" : ""}">${escapeHtml(String(value))}</span>
            </div>
          `
        )
        .join("")}
      <div class="info-section-title">Raw JSON</div>
      <pre class="json-view">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
    </div>
  `;
}

export function renderViewerPanel(state) {
  const isDisplay = state.viewMode === "display";

  return `
    <div class="viewer-panel ${isDisplay ? "is-display" : "is-inspect"}">
      <div class="panel-canvas">
        ${isDisplay ? renderDisplayContent(state) : renderInspectContent(state)}
      </div>
    </div>
  `;
}

const MATRIX_RUNTIME_CLEANUPS = new Set();

function clearMatrixRuntimeBindings() {
  MATRIX_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  MATRIX_RUNTIME_CLEANUPS.clear();
}

function ensureNodePool(container, pool, count, className) {
  while (pool.length < count) {
    const node = document.createElement("div");
    node.className = className;
    container.appendChild(node);
    pool.push(node);
  }

  while (pool.length > count) {
    const node = pool.pop();
    if (node) {
      node.remove();
    }
  }
}

function setMatrixStatus(statusElement, message, tone = "info") {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.remove("error", "info");
  if (tone === "error") {
    statusElement.classList.add("error");
  } else if (tone === "info") {
    statusElement.classList.add("info");
  }
}

function getCachedMatrixBlock(runtime, rowOffset, colOffset, rowLimit, colLimit) {
  const blockKey = buildMatrixBlockKey(
    runtime.selectionKey,
    rowOffset,
    colOffset,
    rowLimit,
    colLimit
  );
  return MATRIX_BLOCK_CACHE.get(blockKey) || null;
}

function getMatrixCellValue(runtime, row, col) {
  const rowOffset = Math.floor(row / runtime.blockRows) * runtime.blockRows;
  const colOffset = Math.floor(col / runtime.blockCols) * runtime.blockCols;
  const rowLimit = Math.min(runtime.blockRows, runtime.rows - rowOffset);
  const colLimit = Math.min(runtime.blockCols, runtime.cols - colOffset);
  const block = getCachedMatrixBlock(runtime, rowOffset, colOffset, rowLimit, colLimit);

  if (!block || !Array.isArray(block.data)) {
    return null;
  }

  const resolvedRowOffset = toSafeInteger(block.row_offset, rowOffset);
  const resolvedColOffset = toSafeInteger(block.col_offset, colOffset);
  const localRow = row - resolvedRowOffset;
  const localCol = col - resolvedColOffset;
  return block.data?.[localRow]?.[localCol] ?? null;
}

function initializeMatrixRuntime(shell) {
  if (!shell || shell.dataset.matrixBound === "true") {
    return;
  }

  const table = shell.querySelector("[data-matrix-table]");
  const headerCellsLayer = shell.querySelector("[data-matrix-header-cells]");
  const indexLayer = shell.querySelector("[data-matrix-index]");
  const cellsLayer = shell.querySelector("[data-matrix-cells]");
  const statusElement =
    shell.closest(".data-section")?.querySelector("[data-matrix-status]") || null;

  if (!table || !headerCellsLayer || !indexLayer || !cellsLayer) {
    return;
  }

  const rows = Math.max(0, toSafeInteger(shell.dataset.matrixRows, 0));
  const cols = Math.max(0, toSafeInteger(shell.dataset.matrixCols, 0));
  const blockRows = Math.max(1, toSafeInteger(shell.dataset.matrixBlockRows, 200));
  const blockCols = Math.max(1, toSafeInteger(shell.dataset.matrixBlockCols, 50));
  const fileKey = shell.dataset.matrixFileKey || "";
  const path = shell.dataset.matrixPath || "/";
  const displayDims = shell.dataset.matrixDisplayDims || "";
  const fixedIndices = shell.dataset.matrixFixedIndices || "";
  const selectionKey =
    shell.dataset.matrixSelectionKey ||
    buildMatrixSelectionKey(fileKey, path, displayDims, fixedIndices);
  const notation = shell.dataset.matrixNotation || "auto";

  if (!rows || !cols || !fileKey) {
    setMatrixStatus(statusElement, "No matrix data available.", "error");
    return;
  }

  shell.dataset.matrixBound = "true";

  const runtime = {
    rows,
    cols,
    blockRows,
    blockCols,
    fileKey,
    path,
    displayDims,
    fixedIndices,
    selectionKey,
    notation,
    pendingCount: 0,
    loadedBlocks: 0,
    destroyed: false,
    rafToken: null,
    headerPool: [],
    rowIndexPool: [],
    cellPool: [],
  };

  const visible = {
    rowStart: 0,
    rowEnd: 0,
    colStart: 0,
    colEnd: 0,
  };

  function queueRender() {
    if (runtime.destroyed || runtime.rafToken !== null) {
      return;
    }

    runtime.rafToken = requestAnimationFrame(() => {
      runtime.rafToken = null;
      renderViewport();
    });
  }

  function updateStatusFromRuntime() {
    if (runtime.pendingCount > 0) {
      setMatrixStatus(statusElement, "Loading blocks...", "info");
      return;
    }

    setMatrixStatus(
      statusElement,
      runtime.loadedBlocks > 0
        ? `Loaded ${runtime.loadedBlocks} block${runtime.loadedBlocks > 1 ? "s" : ""}.`
        : "Scroll to stream blocks.",
      "info"
    );
  }

  async function requestBlock(rowOffset, colOffset, rowLimit, colLimit) {
    const safeRowLimit = Math.min(rowLimit, Math.max(0, runtime.rows - rowOffset));
    const safeColLimit = Math.min(colLimit, Math.max(0, runtime.cols - colOffset));

    if (safeRowLimit <= 0 || safeColLimit <= 0) {
      return;
    }

    const blockKey = buildMatrixBlockKey(
      runtime.selectionKey,
      rowOffset,
      colOffset,
      safeRowLimit,
      safeColLimit
    );

    if (MATRIX_BLOCK_CACHE.get(blockKey) || MATRIX_PENDING.has(blockKey)) {
      return;
    }

    MATRIX_PENDING.add(blockKey);
    runtime.pendingCount += 1;
    updateStatusFromRuntime();

    const params = {
      mode: "matrix",
      row_offset: rowOffset,
      row_limit: safeRowLimit,
      col_offset: colOffset,
      col_limit: safeColLimit,
    };

    if (runtime.displayDims) {
      params.display_dims = runtime.displayDims;
    }

    if (runtime.fixedIndices) {
      params.fixed_indices = runtime.fixedIndices;
    }

    try {
      const response = await getFileData(runtime.fileKey, runtime.path, params, {
        cancelPrevious: false,
      });

      MATRIX_BLOCK_CACHE.set(blockKey, response);
      runtime.loadedBlocks += 1;

      if (!runtime.destroyed) {
        queueRender();
      }
    } catch (error) {
      if (!runtime.destroyed) {
        setMatrixStatus(
          statusElement,
          error?.message || "Failed to load matrix block.",
          "error"
        );
      }
    } finally {
      MATRIX_PENDING.delete(blockKey);
      runtime.pendingCount = Math.max(0, runtime.pendingCount - 1);
      if (!runtime.destroyed) {
        updateStatusFromRuntime();
      }
    }
  }

  function requestVisibleBlocks() {
    const blockRowStart = Math.floor(visible.rowStart / runtime.blockRows) * runtime.blockRows;
    const blockRowEnd = Math.floor(visible.rowEnd / runtime.blockRows) * runtime.blockRows;
    const blockColStart = Math.floor(visible.colStart / runtime.blockCols) * runtime.blockCols;
    const blockColEnd = Math.floor(visible.colEnd / runtime.blockCols) * runtime.blockCols;

    for (let row = blockRowStart; row <= blockRowEnd; row += runtime.blockRows) {
      const rowLimit = Math.min(runtime.blockRows, runtime.rows - row);
      for (let col = blockColStart; col <= blockColEnd; col += runtime.blockCols) {
        const colLimit = Math.min(runtime.blockCols, runtime.cols - col);
        void requestBlock(row, col, rowLimit, colLimit);
      }
    }
  }

  function renderViewport() {
    if (runtime.destroyed) {
      return;
    }

    const viewportWidth = table.clientWidth;
    const viewportHeight = table.clientHeight;
    const scrollTop = table.scrollTop;
    const scrollLeft = table.scrollLeft;

    const contentScrollTop = Math.max(0, scrollTop - MATRIX_HEADER_HEIGHT);
    const contentScrollLeft = Math.max(0, scrollLeft - MATRIX_INDEX_WIDTH);
    const contentHeight = Math.max(0, viewportHeight - MATRIX_HEADER_HEIGHT);
    const contentWidth = Math.max(0, viewportWidth - MATRIX_INDEX_WIDTH);

    visible.rowStart = Math.max(
      0,
      Math.floor(contentScrollTop / MATRIX_ROW_HEIGHT) - MATRIX_OVERSCAN
    );
    visible.rowEnd = Math.min(
      runtime.rows - 1,
      Math.floor((contentScrollTop + contentHeight) / MATRIX_ROW_HEIGHT) + MATRIX_OVERSCAN
    );
    visible.colStart = Math.max(
      0,
      Math.floor(contentScrollLeft / MATRIX_COL_WIDTH) - MATRIX_OVERSCAN
    );
    visible.colEnd = Math.min(
      runtime.cols - 1,
      Math.floor((contentScrollLeft + contentWidth) / MATRIX_COL_WIDTH) + MATRIX_OVERSCAN
    );

    requestVisibleBlocks();

    const visibleCols = [];
    for (let col = visible.colStart; col <= visible.colEnd; col += 1) {
      visibleCols.push(col);
    }

    const visibleRows = [];
    for (let row = visible.rowStart; row <= visible.rowEnd; row += 1) {
      visibleRows.push(row);
    }

    ensureNodePool(
      headerCellsLayer,
      runtime.headerPool,
      visibleCols.length,
      "matrix-cell matrix-cell-header"
    );
    visibleCols.forEach((col, index) => {
      const node = runtime.headerPool[index];
      node.style.left = `${col * MATRIX_COL_WIDTH}px`;
      node.style.width = `${MATRIX_COL_WIDTH}px`;
      node.style.height = `${MATRIX_HEADER_HEIGHT}px`;
      node.textContent = String(col);
    });

    indexLayer.style.transform = "";
    ensureNodePool(
      indexLayer,
      runtime.rowIndexPool,
      visibleRows.length,
      "matrix-cell matrix-cell-index"
    );
    visibleRows.forEach((row, index) => {
      const node = runtime.rowIndexPool[index];
      node.style.left = "0px";
      node.style.top = `${row * MATRIX_ROW_HEIGHT}px`;
      node.style.width = `${MATRIX_INDEX_WIDTH}px`;
      node.style.height = `${MATRIX_ROW_HEIGHT}px`;
      node.textContent = String(row);
    });

    const totalCellCount = visibleRows.length * visibleCols.length;
    ensureNodePool(cellsLayer, runtime.cellPool, totalCellCount, "matrix-cell");

    let cursor = 0;
    visibleRows.forEach((row) => {
      visibleCols.forEach((col) => {
        const node = runtime.cellPool[cursor];
        cursor += 1;

        node.style.top = `${row * MATRIX_ROW_HEIGHT}px`;
        node.style.left = `${col * MATRIX_COL_WIDTH}px`;
        node.style.width = `${MATRIX_COL_WIDTH}px`;
        node.style.height = `${MATRIX_ROW_HEIGHT}px`;

        const value = getMatrixCellValue(runtime, row, col);
        node.textContent = value === null ? "--" : formatCell(value, runtime.notation);
      });
    });
  }

  const onScroll = () => {
    queueRender();
  };
  table.addEventListener("scroll", onScroll, { passive: true });

  let resizeObserver = null;
  const onWindowResize = () => {
    queueRender();
  };

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onWindowResize);
    resizeObserver.observe(table);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  updateStatusFromRuntime();
  queueRender();

  const cleanup = () => {
    runtime.destroyed = true;
    table.removeEventListener("scroll", onScroll);
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", onWindowResize);
    }
    if (runtime.rafToken !== null) {
      cancelAnimationFrame(runtime.rafToken);
      runtime.rafToken = null;
    }
  };

  MATRIX_RUNTIME_CLEANUPS.add(cleanup);
}

export function bindViewerPanelEvents(root, actions) {
  clearMatrixRuntimeBindings();

  root.querySelectorAll("[data-axis-change]").forEach((button) => {
    button.addEventListener("click", () => {
      const axis = button.dataset.axisChange || "x";
      const dim = Number(button.dataset.axisDim);
      actions.setDisplayAxis(axis, dim);
    });
  });

  root.querySelectorAll("[data-display-dim-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.dimIndex);
      const dim = Number(select.value);
      actions.setDisplayDim(index, dim);
    });
  });

  root.querySelectorAll("[data-fixed-index-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-fixed-index-number]").forEach((input) => {
    input.addEventListener("change", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-dim-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.applyDisplayConfig();
    });
  });

  root.querySelectorAll("[data-dim-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.resetDisplayConfigFromPreview();
    });
  });

  root.querySelectorAll("[data-matrix-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableMatrixFullView();
    });
  });

  root.querySelectorAll("[data-matrix-shell]").forEach((shell) => {
    initializeMatrixRuntime(shell);
  });
}
