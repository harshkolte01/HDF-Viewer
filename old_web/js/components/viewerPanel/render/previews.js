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

export { renderTablePreview, renderLinePreview, renderHeatmapPreview };
