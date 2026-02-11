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
const LINE_VIEW_CACHE = new LruCache(240);
const LINE_FETCH_DEBOUNCE_MS = 220;
const LINE_MIN_VIEW_SPAN = 64;
const LINE_SVG_WIDTH = 980;
const LINE_SVG_HEIGHT = 340;
const LINE_DEFAULT_QUALITY = "auto";
const LINE_DEFAULT_OVERVIEW_MAX_POINTS = 5000;
const LINE_EXACT_MAX_POINTS = 20000;
const LINE_WINDOW_OPTIONS = [256, 512, 1000, 2000, 5000, 10000, 20000];
const LINE_KEYBOARD_PAN_RATIO = 0.25;

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

function normalizeLineQuality(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "overview" || normalized === "exact" || normalized === "auto") {
    return normalized;
  }
  return LINE_DEFAULT_QUALITY;
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

let axisLabelMeasureContext = null;

function measureAxisLabelWidth(text) {
  const value = String(text ?? "");
  if (!value) {
    return 0;
  }

  if (typeof document === "undefined") {
    return value.length * 7;
  }

  if (!axisLabelMeasureContext) {
    const canvas = document.createElement("canvas");
    axisLabelMeasureContext = canvas.getContext("2d");
  }

  if (!axisLabelMeasureContext) {
    return value.length * 7;
  }

  axisLabelMeasureContext.font =
    "600 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  return axisLabelMeasureContext.measureText(value).width;
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

function renderLinePreview(preview, options = {}) {
  const points = getLinePoints(preview);
  const lineGrid = options.lineGrid !== false;
  const lineAspect = ["line", "point", "both"].includes(options.lineAspect)
    ? options.lineAspect
    : "line";

  if (points.length < 2) {
    return '<div class="panel-state"><div class="state-text">No numeric line preview is available for this selection.</div></div>';
  }

  const width = 760;
  const height = 320;

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const tickCount = 6;
  const xTickValues = Array.from({ length: tickCount }, (_, idx) => {
    const ratio = idx / Math.max(1, tickCount - 1);
    return minX + ratio * spanX;
  });
  const yTickValues = Array.from({ length: tickCount }, (_, idx) => {
    const ratio = idx / Math.max(1, tickCount - 1);
    return maxY - ratio * spanY;
  });
  const xTickLabelsText = xTickValues.map((value) => formatCell(value));
  const yTickLabelsText = yTickValues.map((value) => formatCell(value));
  const maxYLabelWidth = yTickLabelsText.reduce(
    (maxWidth, label) => Math.max(maxWidth, measureAxisLabelWidth(label)),
    0
  );
  const firstXHalf = xTickLabelsText.length
    ? measureAxisLabelWidth(xTickLabelsText[0]) / 2
    : 0;
  const lastXHalf = xTickLabelsText.length
    ? measureAxisLabelWidth(xTickLabelsText[xTickLabelsText.length - 1]) / 2
    : 0;

  const padding = {
    top: 24,
    right: clamp(Math.ceil(lastXHalf + 12), 22, Math.floor(width * 0.22)),
    bottom: 38,
    left: clamp(
      Math.ceil(Math.max(maxYLabelWidth + 14, firstXHalf + 8, 58)),
      58,
      Math.floor(width * 0.32)
    ),
  };
  const chartWidth = Math.max(120, width - padding.left - padding.right);
  const chartHeight = Math.max(120, height - padding.top - padding.bottom);
  const yAxisTitleX = Math.max(12, Math.round(padding.left * 0.28));

  const toChartPoint = (point) => {
    const x = padding.left + ((point.x - minX) / spanX) * chartWidth;
    const y = padding.top + chartHeight - ((point.y - minY) / spanY) * chartHeight;
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

  const gridLines = Array.from({ length: tickCount }, (_, idx) => {
    const ratio = idx / Math.max(1, tickCount - 1);
    const x = padding.left + ratio * chartWidth;
    const y = padding.top + ratio * chartHeight;
    return {
      vertical: `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${
        padding.top + chartHeight
      }"></line>`,
      horizontal: `<line x1="${padding.left}" y1="${y}" x2="${
        padding.left + chartWidth
      }" y2="${y}"></line>`,
    };
  });

  const xTickLabels = xTickLabelsText
    .map((label, idx) => {
      const ratio = idx / Math.max(1, tickCount - 1);
      const x = padding.left + ratio * chartWidth;
      return `<text x="${x}" y="${padding.top + chartHeight + 18}" text-anchor="middle">${escapeHtml(
        label
      )}</text>`;
    })
    .join("");
  const yTickLabels = yTickLabelsText
    .map((label, idx) => {
      const ratio = idx / Math.max(1, tickCount - 1);
      const y = padding.top + ratio * chartHeight;
      return `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(
        label
      )}</text>`;
    })
    .join("");

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
            <g class="line-grid">${lineGrid ? gridLines.map((line) => line.vertical + line.horizontal).join("") : ""}</g>
            <g class="line-axis">
              <line
                x1="${padding.left}"
                y1="${padding.top + chartHeight}"
                x2="${padding.left + chartWidth}"
                y2="${padding.top + chartHeight}"
              ></line>
              <line
                x1="${padding.left}"
                y1="${padding.top}"
                x2="${padding.left}"
                y2="${padding.top + chartHeight}"
              ></line>
            </g>
            <g class="line-axis-labels">
              ${xTickLabels}
              ${yTickLabels}
            </g>
            <g class="line-axis-titles">
              <text class="line-axis-title line-axis-title-x" x="${
                padding.left + chartWidth / 2
              }" y="${height - 6}" text-anchor="middle">Index</text>
              <text
                class="line-axis-title line-axis-title-y"
                x="${yAxisTitleX}"
                y="${padding.top + chartHeight / 2}"
                text-anchor="middle"
                transform="rotate(-90, ${yAxisTitleX}, ${padding.top + chartHeight / 2})"
              >
                Value
              </text>
            </g>
            ${lineAspect === "point" ? "" : `<path class="line-path" d="${path}"></path>`}
            ${lineAspect === "line" ? "" : `<g class="line-points">${markers}</g>`}
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

function buildLineSelectionKey(fileKey, path, displayDimsParam, fixedIndicesParam, lineIndex) {
  return [
    fileKey || "no-file",
    path || "/",
    displayDimsParam || "none",
    fixedIndicesParam || "none",
    lineIndex ?? "auto",
  ].join("|");
}

function resolveLineRuntimeConfig(state, preview) {
  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const dims = controls.appliedDisplayDims;
  const fixedIndices = controls.appliedFixedIndices || {};

  if (!shape.length) {
    return {
      supported: false,
      totalPoints: 0,
      rowCount: 0,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey: "",
    };
  }

  if (shape.length === 1) {
    const totalPoints = Math.max(0, toSafeInteger(shape[0], 0));
    const selectionKey = buildLineSelectionKey(
      state.selectedFile,
      state.selectedPath,
      "",
      "",
      null
    );

    return {
      supported: totalPoints > 0,
      totalPoints,
      rowCount: 1,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey,
    };
  }

  if (!Array.isArray(dims) || dims.length !== 2) {
    return {
      supported: false,
      totalPoints: 0,
      rowCount: 0,
      displayDimsParam: "",
      fixedIndicesParam: "",
      lineIndex: null,
      selectionKey: "",
    };
  }

  const rowDim = dims[0];
  const colDim = dims[1];
  const rowCount = Math.max(0, toSafeInteger(shape[rowDim], 0));
  const totalPoints = Math.max(0, toSafeInteger(shape[colDim], 0));
  const lineIndex = rowCount > 0 ? Math.floor(rowCount / 2) : null;
  const displayDimsParam = buildDisplayDimsParam(dims);
  const fixedIndicesParam = buildFixedIndicesParam(fixedIndices);
  const selectionKey = buildLineSelectionKey(
    state.selectedFile,
    state.selectedPath,
    displayDimsParam,
    fixedIndicesParam,
    lineIndex
  );

  return {
    supported: rowCount > 0 && totalPoints > 0,
    totalPoints,
    rowCount,
    displayDimsParam,
    fixedIndicesParam,
    lineIndex,
    selectionKey,
  };
}

function renderVirtualLineShell(state, config) {
  const windowOptions = LINE_WINDOW_OPTIONS.filter((size) => size <= config.totalPoints);
  if (!windowOptions.includes(config.totalPoints)) {
    windowOptions.push(config.totalPoints);
  }

  return `
    <div
      class="line-chart-shell line-chart-shell-full"
      data-line-shell="true"
      data-line-file-key="${escapeHtml(state.selectedFile || "")}"
      data-line-path="${escapeHtml(state.selectedPath || "/")}"
      data-line-display-dims="${escapeHtml(config.displayDimsParam || "")}"
      data-line-fixed-indices="${escapeHtml(config.fixedIndicesParam || "")}"
      data-line-selection-key="${escapeHtml(config.selectionKey || "")}"
      data-line-total-points="${config.totalPoints}"
      data-line-index="${config.lineIndex ?? ""}"
      data-line-notation="${escapeHtml(state.notation || "auto")}"
      data-line-grid="${state.lineGrid ? "1" : "0"}"
      data-line-aspect="${escapeHtml(state.lineAspect || "line")}"
      data-line-quality="${LINE_DEFAULT_QUALITY}"
      data-line-overview-max-points="${LINE_DEFAULT_OVERVIEW_MAX_POINTS}"
      data-line-exact-max-points="${LINE_EXACT_MAX_POINTS}"
    >
      <div class="line-chart-toolbar">
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn" data-line-pan-toggle="true">Hand</button>
          <button type="button" class="line-tool-btn" data-line-zoom-in="true">Zoom +</button>
          <button type="button" class="line-tool-btn" data-line-zoom-out="true">Zoom -</button>
          <button type="button" class="line-tool-btn" data-line-reset-view="true">Reset</button>
        </div>
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn" data-line-jump-start="true">Start</button>
          <button type="button" class="line-tool-btn" data-line-step-prev="true">Prev</button>
          <button type="button" class="line-tool-btn" data-line-step-next="true">Next</button>
          <button type="button" class="line-tool-btn" data-line-jump-end="true">End</button>
        </div>
        <div class="line-tool-group line-tool-group-controls line-tool-group-fullscreen-only">
          <span class="line-tool-label">Quality</span>
          <select class="line-tool-select" data-line-quality-select="true">
            <option value="auto">Auto</option>
            <option value="overview">Overview</option>
            <option value="exact">Exact Window</option>
          </select>
          <span class="line-tool-label">Window</span>
          <select class="line-tool-select" data-line-window-select="true">
            ${windowOptions
              .map((size) => `<option value="${size}">${size.toLocaleString()}</option>`)
              .join("")}
          </select>
          <span class="line-tool-label">Index</span>
          <input
            type="number"
            class="line-tool-input"
            data-line-jump-input="true"
            min="0"
            max="${Math.max(0, config.totalPoints - 1)}"
            step="1"
            value="0"
          />
          <button type="button" class="line-tool-btn" data-line-jump-to-index="true">Go</button>
        </div>
        <div class="line-tool-group">
          <span class="line-zoom-label" data-line-zoom-label="true">100%</span>
          <button type="button" class="line-tool-btn" data-line-fullscreen-toggle="true">Fullscreen</button>
          <span class="line-zoom-label" data-line-range-label="true">Range: --</span>
        </div>
      </div>
      <div class="line-chart-stage">
        <div class="line-chart-canvas" data-line-canvas="true" tabindex="0" role="application" aria-label="Line chart">
          <svg
            viewBox="0 0 ${LINE_SVG_WIDTH} ${LINE_SVG_HEIGHT}"
            width="100%"
            height="100%"
            role="img"
            aria-label="Full line view"
            data-line-svg="true"
          ></svg>
          <div class="line-hover" data-line-hover="true" hidden></div>
        </div>
      </div>
      <div class="line-stats">
        <span data-line-stat-min="true">min: --</span>
        <span data-line-stat-max="true">max: --</span>
        <span data-line-stat-span="true">span: --</span>
      </div>
    </div>
  `;
}

function renderLineSection(state, preview) {
  const config = resolveLineRuntimeConfig(state, preview);
  const canLoadFull = config.supported && config.totalPoints > 0;
  const isEnabled = state.lineFullEnabled === true && canLoadFull;

  const statusText = !config.supported
    ? config.rowCount === 0
      ? "Line full view requires at least 1 row in the selected Y dimension."
      : "Line full view is unavailable for this dataset."
    : config.totalPoints <= 0
    ? "No values available for line rendering."
    : isEnabled
    ? "Wheel to zoom. Use Hand to pan."
    : "Preview mode. Click Load full line.";
  const statusTone = !config.supported || config.totalPoints <= 0 ? "error" : "info";
  const statusClass = `data-status ${statusTone === "error" ? "error" : "info"}`;

  const content = isEnabled
    ? renderVirtualLineShell(state, config)
    : renderLinePreview(preview, {
        lineGrid: state.lineGrid,
        lineAspect: state.lineAspect,
      });

  return `
    <div class="data-section">
      <div class="data-actions">
        <button
          type="button"
          class="data-btn"
          data-line-enable="true"
          ${!canLoadFull || isEnabled ? "disabled" : ""}
        >
          Load full line
        </button>
        <span class="${statusClass}" data-line-status="true">${escapeHtml(statusText)}</span>
      </div>
      ${content}
    </div>
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
    dataSection = renderLineSection(state, preview);
  } else if (activeTab === "heatmap" && Number(preview.ndim || 0) >= 2) {
    dataSection = `<div class="data-section">${renderHeatmapPreview(preview)}</div>`;
  }

  const isLineFixedLayout = activeTab === "line" && state.lineFullEnabled === true;

  return `
    <div class="preview-shell ${isLineFixedLayout ? "preview-shell-line-fixed" : ""}">
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
  const isLineFixedPage =
    isDisplay &&
    (state.displayTab || "table") === "line" &&
    state.lineFullEnabled === true;

  return `
    <div class="viewer-panel ${isDisplay ? "is-display" : "is-inspect"}">
      <div class="panel-canvas ${isLineFixedPage ? "panel-canvas-line-fixed" : ""}">
        ${isDisplay ? renderDisplayContent(state) : renderInspectContent(state)}
      </div>
    </div>
  `;
}

const MATRIX_RUNTIME_CLEANUPS = new Set();
const LINE_RUNTIME_CLEANUPS = new Set();

function clearViewerRuntimeBindings() {
  MATRIX_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  MATRIX_RUNTIME_CLEANUPS.clear();

  LINE_RUNTIME_CLEANUPS.forEach((cleanup) => {
    try {
      cleanup();
    } catch (_error) {
      // ignore cleanup errors for detached nodes
    }
  });
  LINE_RUNTIME_CLEANUPS.clear();
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

function initializeLineRuntime(shell) {
  if (!shell || shell.dataset.lineBound === "true") {
    return;
  }

  const canvas = shell.querySelector("[data-line-canvas]");
  const svg = shell.querySelector("[data-line-svg]");
  const rangeLabel = shell.querySelector("[data-line-range-label]");
  const zoomLabel = shell.querySelector("[data-line-zoom-label]");
  const hoverElement = shell.querySelector("[data-line-hover]");
  const minStat = shell.querySelector("[data-line-stat-min]");
  const maxStat = shell.querySelector("[data-line-stat-max]");
  const spanStat = shell.querySelector("[data-line-stat-span]");
  const panToggleButton = shell.querySelector("[data-line-pan-toggle]");
  const zoomInButton = shell.querySelector("[data-line-zoom-in]");
  const zoomOutButton = shell.querySelector("[data-line-zoom-out]");
  const resetButton = shell.querySelector("[data-line-reset-view]");
  const jumpStartButton = shell.querySelector("[data-line-jump-start]");
  const stepPrevButton = shell.querySelector("[data-line-step-prev]");
  const stepNextButton = shell.querySelector("[data-line-step-next]");
  const jumpEndButton = shell.querySelector("[data-line-jump-end]");
  const qualitySelect = shell.querySelector("[data-line-quality-select]");
  const windowSelect = shell.querySelector("[data-line-window-select]");
  const jumpInput = shell.querySelector("[data-line-jump-input]");
  const jumpToIndexButton = shell.querySelector("[data-line-jump-to-index]");
  const fullscreenButton = shell.querySelector("[data-line-fullscreen-toggle]");
  const statusElement =
    shell.closest(".data-section")?.querySelector("[data-line-status]") || null;

  if (!canvas || !svg) {
    return;
  }

  const fileKey = shell.dataset.lineFileKey || "";
  const path = shell.dataset.linePath || "/";
  const displayDims = shell.dataset.lineDisplayDims || "";
  const fixedIndices = shell.dataset.lineFixedIndices || "";
  const notation = shell.dataset.lineNotation || "auto";
  const lineGrid = shell.dataset.lineGrid !== "0";
  const lineAspect = shell.dataset.lineAspect || "line";
  const initialQuality = normalizeLineQuality(shell.dataset.lineQuality);
  const overviewMaxPoints = Math.max(
    1,
    toSafeInteger(shell.dataset.lineOverviewMaxPoints, LINE_DEFAULT_OVERVIEW_MAX_POINTS)
  );
  const exactMaxPoints = Math.max(
    1,
    toSafeInteger(shell.dataset.lineExactMaxPoints, LINE_EXACT_MAX_POINTS)
  );
  const selectionKey =
    shell.dataset.lineSelectionKey ||
    buildLineSelectionKey(fileKey, path, displayDims, fixedIndices, null);
  const totalPoints = Math.max(0, toSafeInteger(shell.dataset.lineTotalPoints, 0));
  const parsedLineIndex = toSafeInteger(shell.dataset.lineIndex, null);
  const lineIndex = Number.isFinite(parsedLineIndex) ? parsedLineIndex : null;

  if (!fileKey || totalPoints <= 0) {
    setMatrixStatus(statusElement, "No line data available.", "error");
    return;
  }

  shell.dataset.lineBound = "true";

  const runtime = {
    fileKey,
    path,
    displayDims,
    fixedIndices,
    notation,
    lineGrid,
    lineAspect,
    selectionKey,
    totalPoints,
    lineIndex,
    qualityRequested: initialQuality,
    qualityApplied: initialQuality,
    overviewMaxPoints,
    exactMaxPoints,
    requestedPoints: 0,
    returnedPoints: 0,
    lineStep: 1,
    minSpan: Math.max(1, Math.min(LINE_MIN_VIEW_SPAN, totalPoints)),
    viewStart: 0,
    viewSpan: totalPoints,
    fetchTimer: null,
    requestSeq: 0,
    destroyed: false,
    panEnabled: false,
    isPanning: false,
    panPointerId: null,
    panStartX: 0,
    panStartViewStart: 0,
    points: [],
    frame: null,
    hoverDot: null,
  };

  function getMaxSpanForQuality() {
    if (runtime.qualityRequested === "exact") {
      return Math.max(1, Math.min(runtime.totalPoints, runtime.exactMaxPoints));
    }
    return runtime.totalPoints;
  }

  function clampViewport(start, span) {
    const maxSpan = getMaxSpanForQuality();
    const minSpan = Math.min(runtime.minSpan, maxSpan);
    const safeSpan = clamp(toSafeInteger(span, maxSpan), minSpan, maxSpan);
    const maxStart = Math.max(0, runtime.totalPoints - safeSpan);
    const safeStart = clamp(toSafeInteger(start, 0), 0, maxStart);
    return { start: safeStart, span: safeSpan };
  }

  function persistViewState() {
    LINE_VIEW_CACHE.set(runtime.selectionKey, {
      start: runtime.viewStart,
      span: runtime.viewSpan,
      panEnabled: runtime.panEnabled === true,
      qualityRequested: runtime.qualityRequested,
    });
  }

  const cachedView = LINE_VIEW_CACHE.get(runtime.selectionKey);
  if (cachedView && typeof cachedView === "object") {
    runtime.qualityRequested = normalizeLineQuality(
      cachedView.qualityRequested || runtime.qualityRequested
    );
    const restored = clampViewport(cachedView.start, cachedView.span);
    runtime.viewStart = restored.start;
    runtime.viewSpan = restored.span;
    runtime.panEnabled = cachedView.panEnabled === true;
  }

  function getZoomPercent() {
    if (runtime.totalPoints <= 0) {
      return 100;
    }

    const ratio = runtime.totalPoints / Math.max(1, runtime.viewSpan);
    return Math.max(100, Math.round(ratio * 100));
  }

  function updateZoomLabel() {
    if (!zoomLabel) {
      return;
    }

    zoomLabel.textContent = `${getZoomPercent()}%`;
  }

  function updateRangeLabel(pointCount = null) {
    if (!rangeLabel) {
      return;
    }

    const rangeEnd = Math.max(runtime.viewStart, runtime.viewStart + runtime.viewSpan - 1);
    const baseText = `Range: ${runtime.viewStart.toLocaleString()} - ${rangeEnd.toLocaleString()} of ${Math.max(
      0,
      runtime.totalPoints - 1
    ).toLocaleString()}`;
    rangeLabel.textContent =
      typeof pointCount === "number" && pointCount >= 0
        ? `${baseText} | ${pointCount.toLocaleString()} points`
        : baseText;
  }

  function syncQualityControl() {
    if (!qualitySelect) {
      return;
    }
    if (document.activeElement === qualitySelect) {
      return;
    }
    qualitySelect.value = runtime.qualityRequested;
  }

  function syncWindowControl() {
    if (!windowSelect) {
      return;
    }

    const exactMode = runtime.qualityRequested === "exact";
    Array.from(windowSelect.options).forEach((option) => {
      const value = Math.max(1, toSafeInteger(option.value, 1));
      option.disabled = exactMode && value > runtime.exactMaxPoints;
    });

    if (document.activeElement === windowSelect) {
      return;
    }

    const selected = String(runtime.viewSpan);
    const hasExact = Array.from(windowSelect.options).some((option) => option.value === selected);
    if (hasExact) {
      windowSelect.value = selected;
    }
  }

  function syncJumpInput() {
    if (!jumpInput) {
      return;
    }
    jumpInput.min = "0";
    jumpInput.max = String(Math.max(0, runtime.totalPoints - 1));
    if (document.activeElement === jumpInput) {
      return;
    }

    const current = toSafeInteger(jumpInput.value, null);
    if (current === null) {
      return;
    }

    const clamped = clamp(current, 0, Math.max(0, runtime.totalPoints - 1));
    if (clamped !== current) {
      jumpInput.value = String(clamped);
    }
  }

  function hideHover() {
    if (hoverElement) {
      hoverElement.hidden = true;
    }

    if (runtime.hoverDot) {
      runtime.hoverDot.setAttribute("cx", "-9999");
      runtime.hoverDot.setAttribute("cy", "-9999");
      runtime.hoverDot.style.display = "none";
    }
  }

  function syncPanState() {
    canvas.classList.toggle("is-pan", runtime.panEnabled);
    canvas.classList.toggle("is-grabbing", runtime.isPanning);

    if (panToggleButton) {
      panToggleButton.classList.toggle("active", runtime.panEnabled);
    }
  }

  function syncFullscreenState() {
    const isFullscreen = document.fullscreenElement === shell;
    shell.classList.toggle("is-fullscreen", isFullscreen);
    if (fullscreenButton) {
      fullscreenButton.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
    }
  }

  function updateStats(minValue, maxValue) {
    if (minStat) {
      minStat.textContent = `min: ${formatCell(minValue, runtime.notation)}`;
    }
    if (maxStat) {
      maxStat.textContent = `max: ${formatCell(maxValue, runtime.notation)}`;
    }
    if (spanStat) {
      spanStat.textContent = `span: ${formatCell(maxValue - minValue, runtime.notation)}`;
    }
  }

  function renderSeries(points) {
    const width = LINE_SVG_WIDTH;
    const height = LINE_SVG_HEIGHT;
    const basePadding = { top: 20, right: 18, bottom: 34, left: 48 };
    const baseChartWidth = width - basePadding.left - basePadding.right;
    const baseChartHeight = height - basePadding.top - basePadding.bottom;

    runtime.points = points;
    runtime.frame = null;
    runtime.hoverDot = null;

    if (!Array.isArray(points) || points.length < 2) {
      if (minStat) minStat.textContent = "min: --";
      if (maxStat) maxStat.textContent = "max: --";
      if (spanStat) spanStat.textContent = "span: --";
      svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" class="line-chart-bg"></rect>
        <g class="line-axis">
          <line x1="${basePadding.left}" y1="${basePadding.top + baseChartHeight}" x2="${
        basePadding.left + baseChartWidth
      }" y2="${basePadding.top + baseChartHeight}"></line>
          <line x1="${basePadding.left}" y1="${basePadding.top}" x2="${basePadding.left}" y2="${
        basePadding.top + baseChartHeight
      }"></line>
        </g>
        <text x="${basePadding.left + 8}" y="${
        basePadding.top + 18
      }" class="line-empty-msg">No numeric points in this range.</text>
      `;
      hideHover();
      return;
    }

    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const rawMinX = Math.min(...xValues);
    const rawMaxX = Math.max(...xValues);
    const rawMinY = Math.min(...yValues);
    const rawMaxY = Math.max(...yValues);
    const rawSpanX = rawMaxX - rawMinX;
    const rawSpanY = rawMaxY - rawMinY;
    const domainPadX = rawSpanX === 0 ? 1 : rawSpanX * 0.02;
    const domainPadY = rawSpanY === 0 ? Math.max(Math.abs(rawMinY) * 0.1, 1) : rawSpanY * 0.08;
    const minX = rawMinX - domainPadX;
    const maxX = rawMaxX + domainPadX;
    const minY = rawMinY - domainPadY;
    const maxY = rawMaxY + domainPadY;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const tickCount = 6;
    const tickValues = Array.from({ length: tickCount }, (_, idx) => {
      const ratio = idx / Math.max(1, tickCount - 1);
      return {
        ratio,
        xValue: minX + ratio * spanX,
        yValue: maxY - ratio * spanY,
      };
    });
    const xTickLabelsText = tickValues.map((tick) =>
      formatCell(tick.xValue, runtime.notation)
    );
    const yTickLabelsText = tickValues.map((tick) =>
      formatCell(tick.yValue, runtime.notation)
    );
    const maxYLabelWidth = yTickLabelsText.reduce(
      (maxWidth, label) => Math.max(maxWidth, measureAxisLabelWidth(label)),
      0
    );
    const firstXHalf = xTickLabelsText.length
      ? measureAxisLabelWidth(xTickLabelsText[0]) / 2
      : 0;
    const lastXHalf = xTickLabelsText.length
      ? measureAxisLabelWidth(xTickLabelsText[xTickLabelsText.length - 1]) / 2
      : 0;
    const padding = {
      top: 20,
      right: clamp(Math.ceil(lastXHalf + 12), 20, Math.floor(width * 0.22)),
      bottom: 34,
      left: clamp(
        Math.ceil(Math.max(maxYLabelWidth + 16, firstXHalf + 10, 62)),
        62,
        Math.floor(width * 0.34)
      ),
    };
    const chartWidth = Math.max(140, width - padding.left - padding.right);
    const chartHeight = Math.max(140, height - padding.top - padding.bottom);
    const yAxisTitleX = Math.max(12, Math.round(padding.left * 0.3));

    runtime.frame = {
      width,
      height,
      padding,
      chartWidth,
      chartHeight,
      minX,
      maxX,
      minY,
      maxY,
      spanX,
      spanY,
    };

    updateStats(rawMinY, rawMaxY);

    const toX = (value) => padding.left + ((value - minX) / spanX) * chartWidth;
    const toY = (value) => padding.top + chartHeight - ((value - minY) / spanY) * chartHeight;

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${toX(point.x).toFixed(2)},${toY(point.y).toFixed(2)}`)
      .join(" ");

    const sampleEvery = Math.max(1, Math.ceil(points.length / 450));
    const markers = points
      .filter((_, index) => index % sampleEvery === 0)
      .map((point) => `<circle cx="${toX(point.x).toFixed(2)}" cy="${toY(point.y).toFixed(2)}" r="1.8"></circle>`)
      .join("");

    const ticks = tickValues.map((tick) => {
      const x = padding.left + tick.ratio * chartWidth;
      const y = padding.top + tick.ratio * chartHeight;
      return {
        ratio: tick.ratio,
        x,
        y,
        xValue: tick.xValue,
        yValue: tick.yValue,
      };
    });

    const gridLines = ticks
      .map(
        (tick) => `
          <line x1="${tick.x}" y1="${padding.top}" x2="${tick.x}" y2="${padding.top + chartHeight}"></line>
          <line x1="${padding.left}" y1="${tick.y}" x2="${padding.left + chartWidth}" y2="${tick.y}"></line>
        `
      )
      .join("");

    const xTickLabels = ticks
      .map((tick, idx) => {
        const label = xTickLabelsText[idx] || formatCell(tick.xValue, runtime.notation);
        return `<text x="${tick.x}" y="${padding.top + chartHeight + 18}" text-anchor="middle">${escapeHtml(
          label
        )}</text>`;
      })
      .join("");
    const yTickLabels = ticks
      .map((tick, idx) => {
        const label = yTickLabelsText[idx] || formatCell(tick.yValue, runtime.notation);
        return `<text x="${padding.left - 10}" y="${tick.y + 4}" text-anchor="end">${escapeHtml(
          label
        )}</text>`;
      })
      .join("");

    const showLine = runtime.lineAspect !== "point";
    const showPoints = runtime.lineAspect !== "line";

    svg.innerHTML = `
      <rect x="0" y="0" width="${width}" height="${height}" class="line-chart-bg"></rect>
      <g class="line-grid">${runtime.lineGrid ? gridLines : ""}</g>
      <g class="line-axis">
        <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}"></line>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}"></line>
      </g>
      <g class="line-axis-labels">
        ${xTickLabels}
        ${yTickLabels}
      </g>
      <g class="line-axis-titles">
        <text class="line-axis-title line-axis-title-x" x="${padding.left + chartWidth / 2}" y="${height - 6}" text-anchor="middle">Index</text>
        <text class="line-axis-title line-axis-title-y" x="${yAxisTitleX}" y="${
      padding.top + chartHeight / 2
    }" text-anchor="middle" transform="rotate(-90, ${yAxisTitleX}, ${
          padding.top + chartHeight / 2
        })">Value</text>
      </g>
      ${showLine ? `<path class="line-path" d="${path}"></path>` : ""}
      ${showPoints ? `<g class="line-points">${markers}</g>` : ""}
      <circle class="line-hover-dot" data-line-hover-dot="true" cx="-9999" cy="-9999" r="4"></circle>
    `;
    runtime.hoverDot = svg.querySelector("[data-line-hover-dot]");
    hideHover();
  }

  function scheduleFetch() {
    if (runtime.destroyed) {
      return;
    }

    if (runtime.fetchTimer !== null) {
      clearTimeout(runtime.fetchTimer);
    }

    runtime.fetchTimer = setTimeout(() => {
      runtime.fetchTimer = null;
      void fetchLineRange();
    }, LINE_FETCH_DEBOUNCE_MS);
  }

  async function fetchLineRange() {
    if (runtime.destroyed) {
      return;
    }

    const requestId = ++runtime.requestSeq;
    const offset = runtime.viewStart;
    const limit = runtime.viewSpan;

    setMatrixStatus(statusElement, "Loading line range...", "info");

    const params = {
      mode: "line",
      quality: runtime.qualityRequested,
      max_points: runtime.overviewMaxPoints,
      line_offset: offset,
      line_limit: limit,
    };

    if (runtime.displayDims) {
      params.display_dims = runtime.displayDims;
    }

    if (runtime.fixedIndices) {
      params.fixed_indices = runtime.fixedIndices;
    }

    if (runtime.lineIndex !== null) {
      params.line_dim = "row";
      params.line_index = runtime.lineIndex;
    }

    try {
      const response = await getFileData(runtime.fileKey, runtime.path, params, {
        cancelPrevious: true,
      });

      if (runtime.destroyed || requestId !== runtime.requestSeq) {
        return;
      }

      runtime.qualityApplied = normalizeLineQuality(
        response?.quality_applied || runtime.qualityRequested
      );
      runtime.requestedPoints = Math.max(0, toSafeInteger(response?.requested_points, limit));
      runtime.returnedPoints = Math.max(
        0,
        toSafeInteger(
          response?.returned_points,
          Array.isArray(response?.data) ? response.data.length : 0
        )
      );
      const step = Math.max(
        1,
        toSafeInteger(response?.line_step, toSafeInteger(response?.downsample_info?.step, 1))
      );
      runtime.lineStep = step;
      const responseOffset = Math.max(0, toSafeInteger(response?.line_offset, offset));
      const values = Array.isArray(response?.data) ? response.data : [];

      const points = values
        .map((value, index) => ({
          x: responseOffset + index * step,
          y: Number(value),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

      updateRangeLabel(points.length);
      updateZoomLabel();
      renderSeries(points);
      setMatrixStatus(
        statusElement,
        `${runtime.qualityApplied === "exact" ? "Exact" : "Overview"} loaded ${points.length.toLocaleString()} points (step ${step}).`,
        "info"
      );
    } catch (error) {
      if (runtime.destroyed) {
        return;
      }

      if (error?.isAbort || error?.code === "ABORTED") {
        return;
      }

      setMatrixStatus(statusElement, error?.message || "Failed to load line range.", "error");
    }
  }

  function updateViewport(start, span, immediate = false) {
    const next = clampViewport(start, span);
    const changed = next.start !== runtime.viewStart || next.span !== runtime.viewSpan;
    runtime.viewStart = next.start;
    runtime.viewSpan = next.span;
    updateRangeLabel();
    updateZoomLabel();
    syncWindowControl();
    syncJumpInput();
    persistViewState();

    if (!changed) {
      return;
    }

    if (immediate) {
      void fetchLineRange();
      return;
    }

    scheduleFetch();
  }

  function zoomBy(factor, anchorRatio = 0.5) {
    const nextSpan = Math.round(runtime.viewSpan * factor);
    if (nextSpan === runtime.viewSpan) {
      return;
    }

    const maxSpan = getMaxSpanForQuality();
    const minSpan = Math.min(runtime.minSpan, maxSpan);
    const clampedSpan = clamp(nextSpan, minSpan, maxSpan);
    const focus = runtime.viewStart + Math.round(anchorRatio * runtime.viewSpan);
    const nextStart = focus - Math.round(anchorRatio * clampedSpan);
    updateViewport(nextStart, clampedSpan, false);
  }

  function onWheel(event) {
    if (runtime.totalPoints <= 1) {
      return;
    }

    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
    const factor = event.deltaY < 0 ? 0.88 : 1.12;
    zoomBy(factor, ratio);
  }

  function onPointerDown(event) {
    if (
      !runtime.panEnabled ||
      event.button !== 0 ||
      runtime.totalPoints <= runtime.viewSpan
    ) {
      return;
    }

    runtime.isPanning = true;
    runtime.panPointerId = event.pointerId;
    runtime.panStartX = event.clientX;
    runtime.panStartViewStart = runtime.viewStart;
    syncPanState();
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (runtime.panEnabled && runtime.isPanning && runtime.panPointerId === event.pointerId) {
      const rect = canvas.getBoundingClientRect();
      const deltaPixels = event.clientX - runtime.panStartX;
      const deltaIndex = Math.round((deltaPixels / Math.max(rect.width, 1)) * runtime.viewSpan);
      const nextStart = runtime.panStartViewStart - deltaIndex;
      updateViewport(nextStart, runtime.viewSpan, false);
      return;
    }

    if (!runtime.frame || runtime.points.length < 2) {
      hideHover();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const frame = runtime.frame;
    const svgX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * frame.width;
    const svgY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * frame.height;
    const ratioX = (svgX - frame.padding.left) / frame.chartWidth;
    const ratioY = (svgY - frame.padding.top) / frame.chartHeight;

    if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) {
      hideHover();
      return;
    }

    const pointIndex = clamp(
      Math.round(ratioX * (runtime.points.length - 1)),
      0,
      runtime.points.length - 1
    );
    const point = runtime.points[pointIndex];
    const cx = frame.padding.left + ((point.x - frame.minX) / frame.spanX) * frame.chartWidth;
    const cy = frame.padding.top + frame.chartHeight - ((point.y - frame.minY) / frame.spanY) * frame.chartHeight;

    if (runtime.hoverDot) {
      runtime.hoverDot.setAttribute("cx", cx.toFixed(2));
      runtime.hoverDot.setAttribute("cy", cy.toFixed(2));
      runtime.hoverDot.style.display = "";
    }

    if (hoverElement) {
      hoverElement.hidden = false;
      hoverElement.innerHTML = `
        <div>Index: ${escapeHtml(formatCell(point.x, "exact"))}</div>
        <div>Value: ${escapeHtml(formatCell(point.y, runtime.notation))}</div>
      `;
    }
  }

  function endPan(event) {
    if (!runtime.isPanning) {
      return;
    }

    if (event && runtime.panPointerId !== event.pointerId) {
      return;
    }

    runtime.isPanning = false;
    const activePointerId = runtime.panPointerId;
    runtime.panPointerId = null;
    syncPanState();

    if (
      Number.isFinite(activePointerId) &&
      canvas.hasPointerCapture(activePointerId)
    ) {
      canvas.releasePointerCapture(activePointerId);
    }
  }

  function onPointerLeave() {
    hideHover();
    if (runtime.isPanning) {
      endPan();
    }
  }

  function onTogglePan() {
    runtime.panEnabled = !runtime.panEnabled;
    if (!runtime.panEnabled && runtime.isPanning) {
      endPan();
    }
    syncPanState();
    persistViewState();
  }

  function onZoomIn() {
    zoomBy(1 / 1.15, 0.5);
  }

  function onZoomOut() {
    zoomBy(1.15, 0.5);
  }

  function shiftWindow(direction) {
    if (!Number.isFinite(direction) || direction === 0) {
      return;
    }
    const delta = Math.max(1, Math.round(runtime.viewSpan * direction));
    updateViewport(runtime.viewStart + delta, runtime.viewSpan, true);
  }

  function onJumpStart() {
    updateViewport(0, runtime.viewSpan, true);
  }

  function onJumpEnd() {
    updateViewport(runtime.totalPoints - runtime.viewSpan, runtime.viewSpan, true);
  }

  function onStepPrev() {
    shiftWindow(-1);
  }

  function onStepNext() {
    shiftWindow(1);
  }

  function setQuality(nextQuality) {
    runtime.qualityRequested = normalizeLineQuality(nextQuality);
    runtime.qualityApplied = runtime.qualityRequested;
    syncQualityControl();
    const maxSpan = getMaxSpanForQuality();
    updateViewport(runtime.viewStart, Math.min(runtime.viewSpan, maxSpan), true);
  }

  function onQualityChange() {
    if (!qualitySelect) {
      return;
    }
    setQuality(qualitySelect.value);
  }

  function onWindowChange() {
    if (!windowSelect) {
      return;
    }
    const requested = Math.max(1, toSafeInteger(windowSelect.value, runtime.viewSpan));
    updateViewport(runtime.viewStart, requested, true);
  }

  function onJumpToIndex() {
    if (!jumpInput) {
      return;
    }
    const parsed = toSafeInteger(jumpInput.value, null);
    if (parsed === null) {
      return;
    }

    const target = clamp(parsed, 0, Math.max(0, runtime.totalPoints - 1));
    jumpInput.value = String(target);
    const nextStart = target - Math.floor(runtime.viewSpan / 2);
    updateViewport(nextStart, runtime.viewSpan, true);
  }

  function onJumpInputKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      onJumpToIndex();
    }
  }

  function onKeyDown(event) {
    if (event.defaultPrevented) {
      return;
    }

    const key = event.key;
    if (key === "ArrowLeft") {
      event.preventDefault();
      shiftWindow(-LINE_KEYBOARD_PAN_RATIO);
      return;
    }
    if (key === "ArrowRight") {
      event.preventDefault();
      shiftWindow(LINE_KEYBOARD_PAN_RATIO);
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      onJumpStart();
      return;
    }
    if (key === "End") {
      event.preventDefault();
      onJumpEnd();
      return;
    }
    if (key === "+" || key === "=") {
      event.preventDefault();
      onZoomIn();
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      onZoomOut();
    }
  }

  const onReset = () => {
    const maxSpan = getMaxSpanForQuality();
    updateViewport(0, maxSpan, true);
  };

  async function onToggleFullscreen() {
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement && shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (_error) {
      // ignore fullscreen errors on restricted contexts
    }
  }

  const onFullscreenChange = () => {
    syncFullscreenState();
  };

  if (hoverElement) {
    hoverElement.hidden = true;
  }

  syncPanState();
  syncFullscreenState();
  syncQualityControl();
  syncWindowControl();
  syncJumpInput();
  updateRangeLabel();
  updateZoomLabel();
  persistViewState();
  setMatrixStatus(statusElement, "Loading initial line range...", "info");
  void fetchLineRange();

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endPan);
  canvas.addEventListener("pointercancel", endPan);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("keydown", onKeyDown);
  if (panToggleButton) {
    panToggleButton.addEventListener("click", onTogglePan);
  }
  if (zoomInButton) {
    zoomInButton.addEventListener("click", onZoomIn);
  }
  if (zoomOutButton) {
    zoomOutButton.addEventListener("click", onZoomOut);
  }
  if (resetButton) {
    resetButton.addEventListener("click", onReset);
  }
  if (jumpStartButton) {
    jumpStartButton.addEventListener("click", onJumpStart);
  }
  if (stepPrevButton) {
    stepPrevButton.addEventListener("click", onStepPrev);
  }
  if (stepNextButton) {
    stepNextButton.addEventListener("click", onStepNext);
  }
  if (jumpEndButton) {
    jumpEndButton.addEventListener("click", onJumpEnd);
  }
  if (qualitySelect) {
    qualitySelect.addEventListener("change", onQualityChange);
  }
  if (windowSelect) {
    windowSelect.addEventListener("change", onWindowChange);
  }
  if (jumpToIndexButton) {
    jumpToIndexButton.addEventListener("click", onJumpToIndex);
  }
  if (jumpInput) {
    jumpInput.addEventListener("keydown", onJumpInputKeyDown);
  }
  if (fullscreenButton) {
    fullscreenButton.addEventListener("click", onToggleFullscreen);
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);

  const cleanup = () => {
    persistViewState();
    runtime.destroyed = true;
    hideHover();
    if (runtime.fetchTimer !== null) {
      clearTimeout(runtime.fetchTimer);
      runtime.fetchTimer = null;
    }
    if (runtime.isPanning) {
      endPan();
    }
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", endPan);
    canvas.removeEventListener("pointercancel", endPan);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("keydown", onKeyDown);
    if (panToggleButton) {
      panToggleButton.removeEventListener("click", onTogglePan);
    }
    if (zoomInButton) {
      zoomInButton.removeEventListener("click", onZoomIn);
    }
    if (zoomOutButton) {
      zoomOutButton.removeEventListener("click", onZoomOut);
    }
    if (resetButton) {
      resetButton.removeEventListener("click", onReset);
    }
    if (jumpStartButton) {
      jumpStartButton.removeEventListener("click", onJumpStart);
    }
    if (jumpEndButton) {
      jumpEndButton.removeEventListener("click", onJumpEnd);
    }
    if (stepPrevButton) {
      stepPrevButton.removeEventListener("click", onStepPrev);
    }
    if (stepNextButton) {
      stepNextButton.removeEventListener("click", onStepNext);
    }
    if (qualitySelect) {
      qualitySelect.removeEventListener("change", onQualityChange);
    }
    if (windowSelect) {
      windowSelect.removeEventListener("change", onWindowChange);
    }
    if (jumpToIndexButton) {
      jumpToIndexButton.removeEventListener("click", onJumpToIndex);
    }
    if (jumpInput) {
      jumpInput.removeEventListener("keydown", onJumpInputKeyDown);
    }
    if (fullscreenButton) {
      fullscreenButton.removeEventListener("click", onToggleFullscreen);
    }
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  };

  LINE_RUNTIME_CLEANUPS.add(cleanup);
}

export function bindViewerPanelEvents(root, actions) {
  clearViewerRuntimeBindings();

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

  root.querySelectorAll("[data-line-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableLineFullView();
    });
  });

  root.querySelectorAll("[data-matrix-shell]").forEach((shell) => {
    initializeMatrixRuntime(shell);
  });

  root.querySelectorAll("[data-line-shell]").forEach((shell) => {
    initializeLineRuntime(shell);
  });
}
