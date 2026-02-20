import { getFileData } from "../../../api/hdf5Service.js";
import { cancelPendingRequest } from "../../../api/client.js";
import { clamp, formatCell } from "../shared.js";
import { buildHeatmapSelectionKey } from "../render/config.js";
import { HEATMAP_RUNTIME_CLEANUPS, setMatrixStatus } from "./common.js";

const HEATMAP_MAX_SIZE = 1024;
const HEATMAP_MIN_ZOOM = 1;
const HEATMAP_MAX_ZOOM = 8;
const HEATMAP_PAN_START_ZOOM = 1.2;
const HEATMAP_SELECTION_CACHE_LIMIT = 12;
const HEATMAP_SELECTION_DATA_CACHE = new Map();
const HEATMAP_SELECTION_VIEW_CACHE = new Map();
const HEATMAP_COLOR_STOPS = Object.freeze({
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

function getColorStops(name) {
  return HEATMAP_COLOR_STOPS[name] || HEATMAP_COLOR_STOPS.viridis;
}

function interpolateColor(stops, ratio) {
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

function buildTicks(size, count = 6) {
  const total = Math.max(0, Number(size) || 0);
  if (total <= 0) {
    return [];
  }
  if (total === 1) {
    return [0];
  }
  const target = Math.max(2, Math.min(count, total));
  const ticks = new Set([0, total - 1]);
  for (let index = 1; index < target - 1; index += 1) {
    ticks.add(Math.round((index / (target - 1)) * (total - 1)));
  }
  return Array.from(ticks).sort((a, b) => a - b);
}

/**
 * Build tick marks for the currently visible viewport portion of an axis.
 * @param {number} totalSize  Total number of cells on this axis (rows or cols)
 * @param {number} panOffset  runtime.panX or runtime.panY (negative when panned)
 * @param {number} zoom       runtime.zoom
 * @param {number} chartSpan  layout.chartWidth or layout.chartHeight
 * @param {number} count      desired number of ticks
 * @returns {{dataIndex: number, screenRatio: number}[]}  dataIndex = cell index, screenRatio = 0..1 position on chart axis
 */
function buildViewportTicks(totalSize, panOffset, zoom, chartSpan, count = 6) {
  if (totalSize <= 0 || chartSpan <= 0) return [];
  // visible data range in cell coordinates
  const startCell = (-panOffset / (chartSpan * zoom)) * totalSize;
  const visibleCells = totalSize / zoom;
  const endCell = startCell + visibleCells;
  // clamp to data bounds
  const s = Math.max(0, startCell);
  const e = Math.min(totalSize - 1, endCell);
  if (s >= e) return [{ dataIndex: Math.round(s), screenRatio: 0.5 }];
  // nice tick spacing
  const span = e - s;
  const raw = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 5, 10];
  let step = mag;
  for (const c of candidates) {
    if (c * mag >= raw) { step = c * mag; break; }
  }
  step = Math.max(1, Math.round(step));
  const first = Math.ceil(s / step) * step;
  const ticks = [];
  for (let v = first; v <= e; v += step) {
    // screen position ratio (0..1) within the chart area
    const ratio = totalSize <= 1 ? 0.5 : v / (totalSize - 1);
    // screen position accounting for zoom + pan
    const screenPos = ratio * chartSpan * zoom + panOffset;
    const screenRatio = screenPos / chartSpan;
    if (screenRatio >= -0.01 && screenRatio <= 1.01) {
      ticks.push({ dataIndex: Math.round(v), screenRatio: clamp(screenRatio, 0, 1) });
    }
  }
  return ticks;
}

function formatScaleValue(value) {
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

function toDisplayRow(totalRows, rowIndex) {
  const rows = Math.max(0, Number(totalRows) || 0);
  const row = Math.max(0, Number(rowIndex) || 0);
  if (rows <= 0) {
    return 0;
  }
  return Math.max(0, rows - 1 - row);
}

function normalizeHeatmapGrid(data) {
  if (!Array.isArray(data) || !data.length || !Array.isArray(data[0])) {
    return null;
  }

  const rows = data.length;
  const cols = data[0].length;
  if (!cols) {
    return null;
  }

  const values = new Float64Array(rows * cols);
  let hasFiniteValue = false;
  let min = Infinity;
  let max = -Infinity;
  let cursor = 0;

  for (let row = 0; row < rows; row += 1) {
    const sourceRow = Array.isArray(data[row]) ? data[row] : [];
    for (let col = 0; col < cols; col += 1) {
      const numeric = Number(sourceRow[col]);
      if (Number.isFinite(numeric)) {
        values[cursor] = numeric;
        hasFiniteValue = true;
        min = Math.min(min, numeric);
        max = Math.max(max, numeric);
      } else {
        values[cursor] = Number.NaN;
      }
      cursor += 1;
    }
  }

  if (!hasFiniteValue) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    max = min + 1;
  }

  return {
    rows,
    cols,
    values,
    min,
    max,
  };
}

const LUT_SIZE = 256;
const _lutCache = new Map();

function buildColorLUT(colormap) {
  const key = colormap;
  if (_lutCache.has(key)) return _lutCache.get(key);

  const stops = getColorStops(colormap);
  // Flat Uint8Array: [R0,G0,B0, R1,G1,B1, ...] for 256 entries
  const lut = new Uint8Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const ratio = i / (LUT_SIZE - 1);
    const index = ratio * (stops.length - 1);
    const lower = Math.floor(index);
    const upper = Math.min(lower + 1, stops.length - 1);
    const frac = index - lower;
    const [r1, g1, b1] = stops[lower];
    const [r2, g2, b2] = stops[upper];
    const off = i * 3;
    lut[off] = (r1 + (r2 - r1) * frac + 0.5) | 0;
    lut[off + 1] = (g1 + (g2 - g1) * frac + 0.5) | 0;
    lut[off + 2] = (b1 + (b2 - b1) * frac + 0.5) | 0;
  }
  _lutCache.set(key, lut);
  return lut;
}

function createHeatmapBitmap(grid, min, max, colormap) {
  const surface = document.createElement("canvas");
  surface.width = grid.cols;
  surface.height = grid.rows;
  const context = surface.getContext("2d");
  if (!context) {
    return null;
  }

  const imageData = context.createImageData(grid.cols, grid.rows);
  const pixels = imageData.data;
  const lut = buildColorLUT(colormap);
  const range = max - min || 1;
  const scale = (LUT_SIZE - 1) / range;
  const values = grid.values;
  const len = values.length;

  for (let i = 0; i < len; i += 1) {
    const v = values[i];
    // LUT index: clamp 0..255
    const lutIdx = Number.isFinite(v)
      ? Math.max(0, Math.min(LUT_SIZE - 1, ((v - min) * scale + 0.5) | 0))
      : 0;
    const lutOff = lutIdx * 3;
    const pOff = i << 2;           // i * 4
    pixels[pOff] = lut[lutOff];
    pixels[pOff + 1] = lut[lutOff + 1];
    pixels[pOff + 2] = lut[lutOff + 2];
    pixels[pOff + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return surface;
}

function getLayout(width, height) {
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

  return {
    chartX,
    chartY,
    chartWidth,
    chartHeight,
    colorBarX,
    colorBarY,
    colorBarWidth,
  };
}

function initializeHeatmapRuntime(shell) {
  if (!shell || shell.dataset.heatmapBound === "true") {
    return;
  }

  const canvasHost = shell.querySelector("[data-heatmap-canvas]");
  const canvas = shell.querySelector("[data-heatmap-surface]");
  const tooltip = shell.querySelector("[data-heatmap-hover]");
  const panToggleButton = shell.querySelector("[data-heatmap-pan-toggle]");
  const zoomInButton = shell.querySelector("[data-heatmap-zoom-in]");
  const zoomOutButton = shell.querySelector("[data-heatmap-zoom-out]");
  const resetButton = shell.querySelector("[data-heatmap-reset-view]");
  const fullscreenButton = shell.querySelector("[data-heatmap-fullscreen-toggle]");
  const zoomLabel = shell.querySelector("[data-heatmap-zoom-label]");
  const rangeLabel = shell.querySelector("[data-heatmap-range-label]");
  const minStat = shell.querySelector("[data-heatmap-stat-min]");
  const maxStat = shell.querySelector("[data-heatmap-stat-max]");
  const rangeStat = shell.querySelector("[data-heatmap-stat-range]");
  const statusElement =
    shell.closest(".data-section")?.querySelector("[data-heatmap-status]") || null;

  if (!canvasHost || !canvas) {
    return;
  }

  const fileKey = shell.dataset.heatmapFileKey || "";
  const fileEtag = shell.dataset.heatmapFileEtag || "";
  const path = shell.dataset.heatmapPath || "/";
  const displayDims = shell.dataset.heatmapDisplayDims || "";
  const fixedIndices = shell.dataset.heatmapFixedIndices || "";
  const selectionKey =
    shell.dataset.heatmapSelectionKey ||
    buildHeatmapSelectionKey(fileKey, path, displayDims, fixedIndices);
  const cacheKey = `${selectionKey}|${fileEtag || "no-etag"}`;
  const colormap = shell.dataset.heatmapColormap || "viridis";
  const showGrid = shell.dataset.heatmapGrid !== "0";

  if (!fileKey) {
    setMatrixStatus(statusElement, "No heatmap data available.", "error");
    return;
  }

  shell.dataset.heatmapBound = "true";

  const runtime = {
    fileKey,
    fileEtag,
    path,
    displayDims,
    fixedIndices,
    selectionKey,
    cacheKey,
    colormap,
    showGrid,
    zoom: 1,
    panX: 0,
    panY: 0,
    panEnabled: false,
    isPanning: false,
    panPointerId: null,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0,
    rows: 0,
    cols: 0,
    values: null,
    min: 0,
    max: 1,
    bitmap: null,
    maxSizeClamped: false,
    effectiveMaxSize: HEATMAP_MAX_SIZE,
    layout: null,
    hover: null,
    hoverDisplayRow: null,
    activeCancelKeys: new Set(),
    destroyed: false,
    loadedPhase: "preview",
  };

  function updateLabels() {
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(runtime.zoom * 100)}%`;
    }
    if (rangeLabel) {
      rangeLabel.textContent =
        runtime.rows > 0 && runtime.cols > 0
          ? `Grid: ${runtime.rows.toLocaleString()} x ${runtime.cols.toLocaleString()}`
          : "Grid: --";
    }
    if (minStat) {
      minStat.textContent = `min: ${formatCell(runtime.min)}`;
    }
    if (maxStat) {
      maxStat.textContent = `max: ${formatCell(runtime.max)}`;
    }
    if (rangeStat) {
      rangeStat.textContent =
        runtime.rows > 0 && runtime.cols > 0
          ? `size: ${(runtime.rows * runtime.cols).toLocaleString()} cells`
          : "size: --";
    }
  }

  function persistViewState() {
    HEATMAP_SELECTION_VIEW_CACHE.set(runtime.cacheKey, {
      zoom: runtime.zoom,
      panX: runtime.panX,
      panY: runtime.panY,
      panEnabled: runtime.panEnabled === true,
    });
    if (HEATMAP_SELECTION_VIEW_CACHE.size > HEATMAP_SELECTION_CACHE_LIMIT) {
      const oldestKey = HEATMAP_SELECTION_VIEW_CACHE.keys().next().value;
      if (oldestKey) {
        HEATMAP_SELECTION_VIEW_CACHE.delete(oldestKey);
      }
    }
  }

  function buildLoadedStatusText(phase = runtime.loadedPhase) {
    const prefix = phase === "highres" ? "High-res heatmap loaded" : "Preview heatmap loaded";
    let statusText = `${prefix} (${runtime.rows.toLocaleString()} x ${runtime.cols.toLocaleString()}).`;
    statusText += " Wheel to zoom. Use Hand to pan.";
    if (runtime.maxSizeClamped && phase === "highres") {
      statusText += ` Clamped to ${runtime.effectiveMaxSize}.`;
    }
    return statusText;
  }

  function clampPanForZoom(panX, panY, zoomLevel = runtime.zoom) {
    const layout = runtime.layout;
    if (!layout || zoomLevel <= HEATMAP_MIN_ZOOM) {
      return { x: 0, y: 0 };
    }
    const minX = layout.chartWidth - layout.chartWidth * zoomLevel;
    const minY = layout.chartHeight - layout.chartHeight * zoomLevel;
    return {
      x: clamp(panX, minX, 0),
      y: clamp(panY, minY, 0),
    };
  }

  function restoreCachedHeatmapData() {
    const cachedData = HEATMAP_SELECTION_DATA_CACHE.get(runtime.cacheKey);
    if (!cachedData) {
      return false;
    }

    const grid = {
      rows: Math.max(0, Number(cachedData.rows) || 0),
      cols: Math.max(0, Number(cachedData.cols) || 0),
      values: cachedData.values,
    };
    if (!grid.rows || !grid.cols || !(grid.values instanceof Float64Array)) {
      return false;
    }

    const cachedMin = Number(cachedData.min);
    const cachedMax = Number(cachedData.max);
    const min = Number.isFinite(cachedMin) ? cachedMin : 0;
    const max = Number.isFinite(cachedMax) && cachedMax !== min ? cachedMax : min + 1;
    const bitmap = createHeatmapBitmap(grid, min, max, runtime.colormap);
    if (!bitmap) {
      return false;
    }

    runtime.rows = grid.rows;
    runtime.cols = grid.cols;
    runtime.values = grid.values;
    runtime.min = min;
    runtime.max = max;
    runtime.bitmap = bitmap;
    runtime.maxSizeClamped = cachedData.maxSizeClamped === true;
    runtime.effectiveMaxSize = Number(cachedData.effectiveMaxSize) || HEATMAP_MAX_SIZE;
    runtime.loadedPhase = cachedData.phase === "highres" ? "highres" : "preview";

    const cachedView = HEATMAP_SELECTION_VIEW_CACHE.get(runtime.cacheKey);
    if (cachedView && typeof cachedView === "object") {
      runtime.zoom = clamp(Number(cachedView.zoom) || HEATMAP_MIN_ZOOM, HEATMAP_MIN_ZOOM, HEATMAP_MAX_ZOOM);
      runtime.panX = Number(cachedView.panX) || 0;
      runtime.panY = Number(cachedView.panY) || 0;
      runtime.panEnabled = cachedView.panEnabled === true;
    } else {
      runtime.zoom = HEATMAP_MIN_ZOOM;
      runtime.panX = 0;
      runtime.panY = 0;
    }

    hideTooltip();
    updateLabels();
    setPanState();
    renderHeatmap();

    const clampedPan = clampPanForZoom(runtime.panX, runtime.panY, runtime.zoom);
    runtime.panX = clampedPan.x;
    runtime.panY = clampedPan.y;
    renderHeatmap();
    persistViewState();

    setMatrixStatus(statusElement, buildLoadedStatusText(runtime.loadedPhase), "info");
    return true;
  }

  function setPanState() {
    canvasHost.classList.toggle("is-pan", runtime.panEnabled);
    canvasHost.classList.toggle("is-grabbing", runtime.isPanning);
    const cursor = runtime.isPanning ? "grabbing" : runtime.panEnabled ? "grab" : "crosshair";
    canvasHost.style.cursor = cursor;
    canvas.style.cursor = cursor;
    if (panToggleButton) {
      panToggleButton.classList.toggle("active", runtime.panEnabled);
    }
  }

  function applyFullscreenStyles(entering) {
    if (entering) {
      shell.style.position = "fixed";
      shell.style.inset = "0";
      shell.style.zIndex = "9999";
      shell.style.width = "100vw";
      shell.style.height = "100vh";
      shell.style.borderRadius = "0";
      shell.style.padding = "16px";
      shell.style.boxSizing = "border-box";
      shell.style.background = "var(--bg-primary, #F8FAFF)";
      shell.style.overflow = "auto";
      if (canvasHost) canvasHost.style.height = "calc(100vh - 170px)";
    } else {
      shell.style.cssText = "";
      if (canvasHost) canvasHost.style.height = "";
    }
  }

  function syncFullscreenState() {
    const isFullscreen = shell.classList.contains("is-fullscreen");
    if (fullscreenButton) {
      fullscreenButton.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
    }
    applyFullscreenStyles(isFullscreen);
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.hidden = true;
    }
    runtime.hover = null;
    runtime.hoverDisplayRow = null;
  }

  function resizeCanvasForHost(context) {
    const rect = canvasHost.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 320));
    const height = Math.max(240, Math.floor(rect.height || 240));
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.max(1, Math.floor(width * dpr));
    const targetHeight = Math.max(1, Math.floor(height * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function renderHeatmap() {
    if (runtime.destroyed) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const { width, height } = resizeCanvasForHost(context);
    const layout = getLayout(width, height);
    runtime.layout = layout;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#F8FAFF";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#FFFFFF";
    context.fillRect(layout.chartX, layout.chartY, layout.chartWidth, layout.chartHeight);

    if (runtime.bitmap) {
      const drawX = layout.chartX + runtime.panX;
      const drawY = layout.chartY + runtime.panY;
      const drawWidth = layout.chartWidth * runtime.zoom;
      const drawHeight = layout.chartHeight * runtime.zoom;

      context.save();
      context.beginPath();
      context.rect(layout.chartX, layout.chartY, layout.chartWidth, layout.chartHeight);
      context.clip();
      context.imageSmoothingEnabled = false;
      context.drawImage(runtime.bitmap, drawX, drawY, drawWidth, drawHeight);

      if (
        runtime.showGrid &&
        runtime.zoom >= 2 &&
        runtime.rows > 0 &&
        runtime.cols > 0 &&
        runtime.rows <= 240 &&
        runtime.cols <= 240
      ) {
        const cellWidth = layout.chartWidth / runtime.cols;
        const cellHeight = layout.chartHeight / runtime.rows;
        context.save();
        context.translate(drawX, drawY);
        context.scale(runtime.zoom, runtime.zoom);
        context.strokeStyle = "rgba(255,255,255,0.35)";
        context.lineWidth = 1 / runtime.zoom;
        for (let row = 0; row <= runtime.rows; row += 1) {
          const y = row * cellHeight;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(layout.chartWidth, y);
          context.stroke();
        }
        for (let col = 0; col <= runtime.cols; col += 1) {
          const x = col * cellWidth;
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, layout.chartHeight);
          context.stroke();
        }
        context.restore();
      }

      if (runtime.hover && runtime.rows > 0 && runtime.cols > 0) {
        const cellWidth = (layout.chartWidth / runtime.cols) * runtime.zoom;
        const cellHeight = (layout.chartHeight / runtime.rows) * runtime.zoom;
        const x = drawX + runtime.hover.col * cellWidth;
        const y = drawY + runtime.hover.row * cellHeight;
        context.strokeStyle = "rgba(255,255,255,0.95)";
        context.lineWidth = 1.25;
        context.strokeRect(x, y, cellWidth, cellHeight);
      }
      context.restore();
    }

    context.strokeStyle = "#D9E2F2";
    context.lineWidth = 1;
    context.strokeRect(layout.chartX, layout.chartY, layout.chartWidth, layout.chartHeight);

    context.font = "600 10px 'Segoe UI', Arial, sans-serif";
    context.fillStyle = "#475569";
    context.textAlign = "center";
    // Viewport-aware axis ticks — update as user zooms/pans
    const xTicks = runtime.zoom > 1
      ? buildViewportTicks(runtime.cols, runtime.panX, runtime.zoom, layout.chartWidth)
      : buildTicks(runtime.cols).map((col) => ({
          dataIndex: col,
          screenRatio: runtime.cols <= 1 ? 0.5 : col / (runtime.cols - 1),
        }));
    const yTicks = runtime.zoom > 1
      ? buildViewportTicks(runtime.rows, runtime.panY, runtime.zoom, layout.chartHeight)
      : buildTicks(runtime.rows).map((row) => ({
          dataIndex: row,
          screenRatio: runtime.rows <= 1 ? 0.5 : row / (runtime.rows - 1),
        }));
    xTicks.forEach((tick) => {
      const x = layout.chartX + tick.screenRatio * layout.chartWidth;
      context.fillText(String(tick.dataIndex), x, layout.chartY + layout.chartHeight + 14);
    });
    context.textAlign = "right";
    yTicks.forEach((tick) => {
      const y = layout.chartY + tick.screenRatio * layout.chartHeight + 3;
      const yLabel = toDisplayRow(runtime.rows, tick.dataIndex);
      context.fillText(String(yLabel), layout.chartX - 8, y);
    });

    const gradient = context.createLinearGradient(
      0,
      layout.colorBarY + layout.chartHeight,
      0,
      layout.colorBarY
    );
    const stops = getColorStops(runtime.colormap);
    stops.forEach((color, index) => {
      const offset = index / Math.max(1, stops.length - 1);
      gradient.addColorStop(offset, `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
    });

    context.fillStyle = gradient;
    context.fillRect(
      layout.colorBarX,
      layout.colorBarY,
      layout.colorBarWidth,
      layout.chartHeight
    );
    context.strokeStyle = "#D9E2F2";
    context.strokeRect(
      layout.colorBarX,
      layout.colorBarY,
      layout.colorBarWidth,
      layout.chartHeight
    );

    context.textAlign = "left";
    context.fillStyle = "#475569";
    context.fillText(formatScaleValue(runtime.max), layout.colorBarX + layout.colorBarWidth + 6, layout.colorBarY + 8);
    context.fillText(
      formatScaleValue((runtime.min + runtime.max) / 2),
      layout.colorBarX + layout.colorBarWidth + 6,
      layout.colorBarY + layout.chartHeight / 2 + 3
    );
    context.fillText(
      formatScaleValue(runtime.min),
      layout.colorBarX + layout.colorBarWidth + 6,
      layout.colorBarY + layout.chartHeight - 2
    );
  }

  function applyZoom(nextZoom, anchorX = null, anchorY = null) {
    const clampedZoom = clamp(nextZoom, HEATMAP_MIN_ZOOM, HEATMAP_MAX_ZOOM);
    if (Math.abs(clampedZoom - runtime.zoom) < 0.0005) {
      return;
    }

    const layout = runtime.layout;
    if (!layout) {
      runtime.zoom = clampedZoom;
      runtime.panX = 0;
      runtime.panY = 0;
      updateLabels();
      renderHeatmap();
      persistViewState();
      return;
    }

    const safeAnchorX = Number.isFinite(anchorX) ? anchorX : layout.chartWidth / 2;
    const safeAnchorY = Number.isFinite(anchorY) ? anchorY : layout.chartHeight / 2;
    const scale = clampedZoom / runtime.zoom;
    const nextPanX = safeAnchorX - (safeAnchorX - runtime.panX) * scale;
    const nextPanY = safeAnchorY - (safeAnchorY - runtime.panY) * scale;

    runtime.zoom = clampedZoom;
    const clampedPan = clampPanForZoom(nextPanX, nextPanY, clampedZoom);
    runtime.panX = clampedPan.x;
    runtime.panY = clampedPan.y;
    updateLabels();
    renderHeatmap();
    persistViewState();
  }

  function getRelativePoint(event) {
    const rect = canvasHost.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function updateHover(point) {
    const layout = runtime.layout;
    if (!layout || runtime.rows <= 0 || runtime.cols <= 0 || !runtime.values) {
      hideTooltip();
      return;
    }

    const localX = point.x - layout.chartX;
    const localY = point.y - layout.chartY;
    if (localX < 0 || localX > layout.chartWidth || localY < 0 || localY > layout.chartHeight) {
      hideTooltip();
      renderHeatmap();
      return;
    }

    const scaledX = (localX - runtime.panX) / runtime.zoom;
    const scaledY = (localY - runtime.panY) / runtime.zoom;
    if (
      scaledX < 0 ||
      scaledX > layout.chartWidth ||
      scaledY < 0 ||
      scaledY > layout.chartHeight
    ) {
      hideTooltip();
      renderHeatmap();
      return;
    }

    const col = clamp(Math.floor((scaledX / layout.chartWidth) * runtime.cols), 0, runtime.cols - 1);
    const row = clamp(Math.floor((scaledY / layout.chartHeight) * runtime.rows), 0, runtime.rows - 1);
    const value = runtime.values[row * runtime.cols + col];
    runtime.hover = { row, col, value };
    runtime.hoverDisplayRow = toDisplayRow(runtime.rows, row);

    if (tooltip) {
      const hostRect = canvasHost.getBoundingClientRect();
      const left = clamp(point.x + 12, 8, Math.max(8, hostRect.width - 156));
      const top = clamp(point.y + 12, 8, Math.max(8, hostRect.height - 72));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.right = "auto";
      tooltip.hidden = false;
      tooltip.innerHTML = `
        <div>Y: ${runtime.hoverDisplayRow}</div>
        <div>Col: ${col}</div>
        <div>Value: ${formatCell(value, "auto")}</div>
      `;
    }

    renderHeatmap();
  }

  async function fetchHeatmapAtSize(maxSize, loadingMessage) {
    if (runtime.destroyed) {
      return { loaded: false };
    }

    if (loadingMessage) {
      setMatrixStatus(statusElement, loadingMessage, "info");
    }

    const requestedMaxSize = Math.max(1, Math.min(maxSize, HEATMAP_MAX_SIZE));
    const cancelKey = `heatmap:${runtime.selectionKey}:${requestedMaxSize}`;
    runtime.activeCancelKeys.add(cancelKey);

    const params = {
      mode: "heatmap",
      max_size: requestedMaxSize,
      include_stats: 0,
    };
    if (runtime.displayDims) {
      params.display_dims = runtime.displayDims;
    }
    if (runtime.fixedIndices) {
      params.fixed_indices = runtime.fixedIndices;
    }

    if (runtime.fileEtag) {
      params.etag = runtime.fileEtag;
    }

    try {
      const response = await getFileData(runtime.fileKey, runtime.path, params, {
        cancelPrevious: true,
        cancelKey,
      });

      if (runtime.destroyed) {
        return { loaded: false };
      }

      const grid = normalizeHeatmapGrid(response?.data);
      if (!grid) {
        throw new Error("No valid heatmap matrix returned from API");
      }

      const statsMin = Number(response?.stats?.min);
      const statsMax = Number(response?.stats?.max);
      const min = Number.isFinite(statsMin) ? statsMin : grid.min;
      let max = Number.isFinite(statsMax) ? statsMax : grid.max;
      if (min === max) {
        max = min + 1;
      }

      const bitmap = createHeatmapBitmap(grid, min, max, runtime.colormap);
      if (!bitmap) {
        throw new Error("Failed to build heatmap canvas");
      }

      runtime.rows = grid.rows;
      runtime.cols = grid.cols;
      runtime.values = grid.values;
      runtime.min = min;
      runtime.max = max;
      runtime.bitmap = bitmap;
      runtime.zoom = HEATMAP_MIN_ZOOM;
      runtime.panX = 0;
      runtime.panY = 0;
      runtime.maxSizeClamped = response?.max_size_clamped === true;
      runtime.effectiveMaxSize = Number(response?.effective_max_size) || requestedMaxSize;
      runtime.loadedPhase = requestedMaxSize >= HEATMAP_MAX_SIZE ? "highres" : "preview";

      HEATMAP_SELECTION_DATA_CACHE.set(runtime.cacheKey, {
        rows: runtime.rows,
        cols: runtime.cols,
        values: runtime.values,
        min: runtime.min,
        max: runtime.max,
        maxSizeClamped: runtime.maxSizeClamped,
        effectiveMaxSize: runtime.effectiveMaxSize,
        phase: runtime.loadedPhase,
      });
      if (HEATMAP_SELECTION_DATA_CACHE.size > HEATMAP_SELECTION_CACHE_LIMIT) {
        const oldestKey = HEATMAP_SELECTION_DATA_CACHE.keys().next().value;
        if (oldestKey) {
          HEATMAP_SELECTION_DATA_CACHE.delete(oldestKey);
        }
      }

      hideTooltip();
      updateLabels();
      renderHeatmap();
      persistViewState();

      setMatrixStatus(statusElement, buildLoadedStatusText(runtime.loadedPhase), "info");
      return { loaded: true };
    } catch (error) {
      if (runtime.destroyed) {
        return { loaded: false };
      }
      if (error?.isAbort || error?.code === "ABORTED") {
        return { loaded: false };
      }
      setMatrixStatus(statusElement, error?.message || "Failed to load high-res heatmap.", "error");
      return { loaded: false };
    } finally {
      runtime.activeCancelKeys.delete(cancelKey);
    }
  }

  async function loadHighResHeatmap() {
    // Progressive loading: fast preview first (256), then full resolution (1024)
    const PREVIEW_SIZE = 256;
    const previewResult = await fetchHeatmapAtSize(PREVIEW_SIZE, "Loading heatmap preview...");
    if (runtime.destroyed) return;
    if (previewResult.loaded && HEATMAP_MAX_SIZE > PREVIEW_SIZE) {
      // Small delay so the user sees the preview before the full load starts
      await new Promise((r) => setTimeout(r, 50));
      if (runtime.destroyed) return;
      await fetchHeatmapAtSize(HEATMAP_MAX_SIZE, "Loading full resolution...");
    } else if (!previewResult.loaded) {
      // Fallback: try full size directly
      await fetchHeatmapAtSize(HEATMAP_MAX_SIZE, "Loading high-res heatmap...");
    }
  }

  function cancelInFlightRequests() {
    runtime.activeCancelKeys.forEach((cancelKey) => {
      cancelPendingRequest(cancelKey, "heatmap-runtime-disposed");
    });
    runtime.activeCancelKeys.clear();
  }

  function onWheel(event) {
    event.preventDefault();
    const point = getRelativePoint(event);
    const layout = runtime.layout;
    if (!layout) {
      return;
    }
    const anchorX = clamp(point.x - layout.chartX, 0, layout.chartWidth);
    const anchorY = clamp(point.y - layout.chartY, 0, layout.chartHeight);
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    applyZoom(runtime.zoom * factor, anchorX, anchorY);
  }

  function onPointerDown(event) {
    const isMousePointer = !event.pointerType || event.pointerType === "mouse";
    if (!runtime.panEnabled || (isMousePointer && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    const point = getRelativePoint(event);
    runtime.isPanning = true;
    runtime.panPointerId = event.pointerId;
    runtime.panStartX = point.x;
    runtime.panStartY = point.y;
    runtime.panStartOffsetX = runtime.panX;
    runtime.panStartOffsetY = runtime.panY;
    setPanState();
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    const point = getRelativePoint(event);
    if (runtime.isPanning && runtime.panPointerId === event.pointerId) {
      event.preventDefault();
      const deltaX = point.x - runtime.panStartX;
      const deltaY = point.y - runtime.panStartY;
      const nextPan = clampPanForZoom(
        runtime.panStartOffsetX + deltaX,
        runtime.panStartOffsetY + deltaY,
        runtime.zoom
      );
      runtime.panX = nextPan.x;
      runtime.panY = nextPan.y;
      renderHeatmap();
      persistViewState();
      return;
    }
    updateHover(point);
  }

  function stopPan(event = null) {
    if (!runtime.isPanning) {
      return;
    }
    if (event && runtime.panPointerId !== event.pointerId) {
      return;
    }
    const activePointer = runtime.panPointerId;
    runtime.isPanning = false;
    runtime.panPointerId = null;
    setPanState();
    if (Number.isFinite(activePointer) && canvas.hasPointerCapture(activePointer)) {
      canvas.releasePointerCapture(activePointer);
    }
  }

  function onPointerLeave() {
    if (runtime.isPanning) {
      stopPan();
    }
    hideTooltip();
    renderHeatmap();
  }

  function onTogglePan() {
    runtime.panEnabled = !runtime.panEnabled;
    if (!runtime.panEnabled && runtime.isPanning) {
      stopPan();
    }
    if (runtime.panEnabled && runtime.zoom <= HEATMAP_MIN_ZOOM + 0.001) {
      applyZoom(HEATMAP_PAN_START_ZOOM);
    }
    setPanState();
    persistViewState();
  }

  function onResetView() {
    if (runtime.isPanning) {
      stopPan();
    }
    runtime.zoom = HEATMAP_MIN_ZOOM;
    runtime.panX = 0;
    runtime.panY = 0;
    runtime.panEnabled = false;
    hideTooltip();
    setPanState();
    updateLabels();
    renderHeatmap();
    persistViewState();
  }

  function onZoomIn() {
    applyZoom(runtime.zoom * 1.15);
  }

  function onZoomOut() {
    applyZoom(runtime.zoom / 1.15);
  }

  function onToggleFullscreen() {
    shell.classList.toggle("is-fullscreen");
    syncFullscreenState();
    renderHeatmap();
  }

  function onFullscreenEsc(event) {
    if (event.key === "Escape" && shell.classList.contains("is-fullscreen")) {
      event.preventDefault();
      event.stopPropagation();
      shell.classList.remove("is-fullscreen");
      syncFullscreenState();
      renderHeatmap();
    }
  }

  const onFullscreenClick = () => onToggleFullscreen();

  setPanState();
  syncFullscreenState();
  const restoredFromCache = restoreCachedHeatmapData();
  if (!restoredFromCache) {
    updateLabels();
    renderHeatmap();
    void loadHighResHeatmap();
  }

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", stopPan);
  canvas.addEventListener("pointercancel", stopPan);
  canvas.addEventListener("pointerleave", onPointerLeave);
  if (panToggleButton) panToggleButton.addEventListener("click", onTogglePan);
  if (zoomInButton) zoomInButton.addEventListener("click", onZoomIn);
  if (zoomOutButton) zoomOutButton.addEventListener("click", onZoomOut);
  if (resetButton) resetButton.addEventListener("click", onResetView);
  if (fullscreenButton) fullscreenButton.addEventListener("click", onFullscreenClick);
  document.addEventListener("keydown", onFullscreenEsc);

  let resizeObserver = null;
  const onWindowResize = () => {
    renderHeatmap();
  };
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onWindowResize);
    resizeObserver.observe(canvasHost);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  const cleanup = () => {
    persistViewState();
    runtime.destroyed = true;
    cancelInFlightRequests();
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", stopPan);
    canvas.removeEventListener("pointercancel", stopPan);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    if (panToggleButton) panToggleButton.removeEventListener("click", onTogglePan);
    if (zoomInButton) zoomInButton.removeEventListener("click", onZoomIn);
    if (zoomOutButton) zoomOutButton.removeEventListener("click", onZoomOut);
    if (resetButton) resetButton.removeEventListener("click", onResetView);
    if (fullscreenButton) fullscreenButton.removeEventListener("click", onFullscreenClick);
    document.removeEventListener("keydown", onFullscreenEsc);
    shell.classList.remove("is-fullscreen");
    shell.style.cssText = "";
    if (canvasHost) canvasHost.style.height = "";
    canvasHost.style.cursor = "";
    canvas.style.cursor = "";
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", onWindowResize);
    }
  };

  HEATMAP_RUNTIME_CLEANUPS.add(cleanup);
}

export { initializeHeatmapRuntime };
