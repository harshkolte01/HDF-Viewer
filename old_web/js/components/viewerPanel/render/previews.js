import { escapeHtml } from "../../../utils/format.js";
import { clamp, formatCell, measureAxisLabelWidth } from "../shared.js";
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

const HEATMAP_PREVIEW_MAX_ROWS = 48;
const HEATMAP_PREVIEW_MAX_COLS = 48;

function buildSampledHeatmapRows(rawRows, maxRows = HEATMAP_PREVIEW_MAX_ROWS, maxCols = HEATMAP_PREVIEW_MAX_COLS) {
  const sourceRows = Array.isArray(rawRows) ? rawRows.filter((row) => Array.isArray(row)) : [];
  if (!sourceRows.length) {
    return [];
  }

  const sourceRowCount = sourceRows.length;
  const sourceColCount = sourceRows.reduce(
    (maxCount, row) => Math.max(maxCount, Array.isArray(row) ? row.length : 0),
    0
  );
  if (!sourceColCount) {
    return [];
  }

  const rowStep = Math.max(1, Math.ceil(sourceRowCount / maxRows));
  const colStep = Math.max(1, Math.ceil(sourceColCount / maxCols));
  const sampledRows = [];

  for (let rowIndex = 0; rowIndex < sourceRowCount && sampledRows.length < maxRows; rowIndex += rowStep) {
    const sourceRow = sourceRows[rowIndex] || [];
    const sampledRow = [];

    for (let colIndex = 0; colIndex < sourceColCount && sampledRow.length < maxCols; colIndex += colStep) {
      sampledRow.push(colIndex < sourceRow.length ? sourceRow[colIndex] : null);
    }

    sampledRows.push(sampledRow);
  }

  return sampledRows;
}

const HEATMAP_PREVIEW_COLOR_STOPS = Object.freeze({
  viridis: [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135],
    [126, 3, 167],
    [203, 71, 119],
    [248, 149, 64],
    [240, 249, 33],
  ],
  inferno: [
    [0, 0, 4],
    [87, 15, 109],
    [187, 55, 84],
    [249, 142, 8],
    [252, 255, 164],
  ],
  magma: [
    [0, 0, 4],
    [73, 15, 109],
    [151, 45, 123],
    [221, 82, 72],
    [252, 253, 191],
  ],
  cool: [
    [0, 255, 255],
    [63, 191, 255],
    [127, 127, 255],
    [191, 63, 255],
    [255, 0, 255],
  ],
  hot: [
    [0, 0, 0],
    [128, 0, 0],
    [255, 64, 0],
    [255, 200, 0],
    [255, 255, 255],
  ],
});

function getHeatColorStops(name) {
  return HEATMAP_PREVIEW_COLOR_STOPS[name] || HEATMAP_PREVIEW_COLOR_STOPS.viridis;
}

function interpolateHeatColor(stops, ratio) {
  const clamped = clamp(ratio, 0, 1);
  const index = clamped * (stops.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  if (lower === upper) {
    return stops[lower];
  }
  const [r1, g1, b1] = stops[lower];
  const [r2, g2, b2] = stops[upper];
  return [
    Math.round(r1 + (r2 - r1) * fraction),
    Math.round(g1 + (g2 - g1) * fraction),
    Math.round(b1 + (b2 - b1) * fraction),
  ];
}

function getHeatColor(value, min, max, stops) {
  if (!Number.isFinite(value)) {
    return "#CBD5E1";
  }
  const ratio = max <= min ? 0.5 : clamp((value - min) / (max - min), 0, 1);
  const [r, g, b] = interpolateHeatColor(stops, ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildHeatmapTicks(size, maxTicks = 6) {
  const length = Math.max(0, Number(size) || 0);
  if (length <= 0) {
    return [];
  }
  if (length === 1) {
    return [0];
  }
  const target = Math.max(2, Math.min(maxTicks, length));
  const ticks = new Set([0, length - 1]);
  for (let index = 1; index < target - 1; index += 1) {
    ticks.add(Math.round((index / (target - 1)) * (length - 1)));
  }
  return Array.from(ticks).sort((a, b) => a - b);
}

function formatHeatmapScaleValue(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-3 && value !== 0)) {
    return value.toExponential(2);
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: Math.abs(value) >= 10 ? 1 : 3,
  });
}

function renderHeatmapPreview(preview, options = {}) {
  const colormap = options.heatmapColormap || "viridis";
  const showGrid = options.heatmapGrid !== false;
  const colorStops = getHeatColorStops(colormap);
  const rawRows = buildSampledHeatmapRows(getHeatmapRows(preview));

  if (!rawRows.length) {
    return '<div class="panel-state"><div class="state-text">No matrix preview is available for heatmap rendering.</div></div>';
  }

  const colCount = rawRows.reduce(
    (maxCount, row) => Math.max(maxCount, Array.isArray(row) ? row.length : 0),
    0
  );
  if (!colCount) {
    return '<div class="panel-state"><div class="state-text">Heatmap preview has no columns.</div></div>';
  }

  const rowCount = rawRows.length;
  const normalizedRows = rawRows.map((row) =>
    Array.from({ length: colCount }, (_, index) => (index < row.length ? row[index] : null))
  );

  let min = Infinity;
  let max = -Infinity;
  let hasNumericValue = false;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = normalizedRows[rowIndex];
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const numeric = Number(row[colIndex]);
      if (!Number.isFinite(numeric)) {
        continue;
      }
      hasNumericValue = true;
      min = Math.min(min, numeric);
      max = Math.max(max, numeric);
    }
  }

  if (!hasNumericValue) {
    return '<div class="panel-state"><div class="state-text">Heatmap preview requires numeric values.</div></div>';
  }

  const width = 760;
  const height = 420;
  const paddingLeft = 46;
  const paddingTop = 24;
  const paddingBottom = 34;
  const colorBarWidth = 18;
  const colorBarGap = 16;
  const colorBarLabelWidth = 56;
  const chartWidth = Math.max(
    120,
    width - paddingLeft - colorBarWidth - colorBarGap - colorBarLabelWidth - 12
  );
  const chartHeight = Math.max(120, height - paddingTop - paddingBottom);
  const chartX = paddingLeft;
  const chartY = paddingTop;
  const colorBarX = chartX + chartWidth + colorBarGap;
  const colorBarY = chartY;
  const cellWidth = chartWidth / Math.max(1, colCount);
  const cellHeight = chartHeight / Math.max(1, rowCount);

  const gradientId = `heatmap-preview-gradient-${rowCount}-${colCount}-${Math.round(
    min * 1000
  )}-${Math.round(max * 1000)}`.replace(/[^A-Za-z0-9_-]/g, "");
  const gradientStops = colorStops
    .map((color, index) => {
      const offset = index / Math.max(1, colorStops.length - 1);
      return `<stop offset="${(offset * 100).toFixed(2)}%" stop-color="rgb(${color[0]}, ${color[1]}, ${color[2]})"></stop>`;
    })
    .join("");

  const cellStroke = showGrid && cellWidth >= 4 && cellHeight >= 4 ? "rgba(255,255,255,0.35)" : "none";
  const cellStrokeWidth = cellStroke === "none" ? 0 : 0.5;
  const cellRects = normalizedRows
    .map((row, rowIndex) => {
      return row
        .map((value, colIndex) => {
          const numeric = Number(value);
          const fill = getHeatColor(numeric, min, max, colorStops);
          const x = chartX + colIndex * cellWidth;
          const y = chartY + rowIndex * cellHeight;
          return `
            <rect
              x="${x.toFixed(3)}"
              y="${y.toFixed(3)}"
              width="${cellWidth.toFixed(3)}"
              height="${cellHeight.toFixed(3)}"
              fill="${fill}"
              stroke="${cellStroke}"
              stroke-width="${cellStrokeWidth}"
            ></rect>
          `;
        })
        .join("");
    })
    .join("");

  const xTicks = buildHeatmapTicks(colCount);
  const yTicks = buildHeatmapTicks(rowCount);
  const xTickLabels = xTicks
    .map((col) => {
      const ratio = colCount <= 1 ? 0.5 : col / (colCount - 1);
      const x = chartX + ratio * chartWidth;
      return `<text x="${x.toFixed(2)}" y="${(chartY + chartHeight + 16).toFixed(2)}" text-anchor="middle">${col}</text>`;
    })
    .join("");
  const yTickLabels = yTicks
    .map((row) => {
      const ratio = rowCount <= 1 ? 0.5 : row / (rowCount - 1);
      const y = chartY + ratio * chartHeight + 4;
      const label = Math.max(0, rowCount - 1 - row);
      return `<text x="${(chartX - 10).toFixed(2)}" y="${y.toFixed(2)}" text-anchor="end">${label}</text>`;
    })
    .join("");

  return `
    <div class="line-chart-shell heatmap-chart-shell heatmap-preview-chart-shell">
      <div class="line-chart-toolbar heatmap-chart-toolbar">
        <div class="line-tool-group">
          <span class="line-tool-label">Preview (Sampled)</span>
        </div>
        <div class="line-tool-group">
          <span class="line-zoom-label">Grid: ${rowCount.toLocaleString()} x ${colCount.toLocaleString()}</span>
        </div>
      </div>
      <div class="line-chart-stage">
        <svg
          class="line-chart-canvas heatmap-chart-canvas heatmap-preview-svg"
          viewBox="0 0 ${width} ${height}"
          role="img"
          aria-label="Heatmap preview"
        >
          <defs>
            <linearGradient id="${gradientId}" x1="0%" y1="100%" x2="0%" y2="0%">
              ${gradientStops}
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" class="line-chart-bg"></rect>
          <rect
            x="${chartX}"
            y="${chartY}"
            width="${chartWidth}"
            height="${chartHeight}"
            fill="#FFFFFF"
            stroke="#D9E2F2"
            stroke-width="1"
          ></rect>
          ${cellRects}
          <g class="line-axis-labels">${xTickLabels}${yTickLabels}</g>
          <rect
            x="${colorBarX}"
            y="${colorBarY}"
            width="${colorBarWidth}"
            height="${chartHeight}"
            fill="url(#${gradientId})"
            stroke="#D9E2F2"
            stroke-width="1"
          ></rect>
          <g class="line-axis-labels">
            <text x="${colorBarX + colorBarWidth + 7}" y="${colorBarY + 9}" text-anchor="start">${escapeHtml(
    formatHeatmapScaleValue(max)
  )}</text>
            <text x="${colorBarX + colorBarWidth + 7}" y="${colorBarY + chartHeight / 2 + 3}" text-anchor="start">${escapeHtml(
    formatHeatmapScaleValue((min + max) / 2)
  )}</text>
            <text x="${colorBarX + colorBarWidth + 7}" y="${colorBarY + chartHeight - 2}" text-anchor="start">${escapeHtml(
    formatHeatmapScaleValue(min)
  )}</text>
          </g>
        </svg>
      </div>
      <div class="line-stats">
        <span>min: ${escapeHtml(formatCell(min))}</span>
        <span>max: ${escapeHtml(formatCell(max))}</span>
        <span>size: ${(rowCount * colCount).toLocaleString()} cells</span>
      </div>
    </div>
  `;
}

export { renderTablePreview, renderLinePreview, renderHeatmapPreview };

