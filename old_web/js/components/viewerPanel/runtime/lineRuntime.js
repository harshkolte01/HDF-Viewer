import { getFileData } from "../../../api/hdf5Service.js";
import { escapeHtml } from "../../../utils/format.js";
import {
  LINE_VIEW_CACHE,
  LINE_FETCH_DEBOUNCE_MS,
  LINE_MIN_VIEW_SPAN,
  LINE_SVG_WIDTH,
  LINE_SVG_HEIGHT,
  LINE_DEFAULT_QUALITY,
  LINE_DEFAULT_OVERVIEW_MAX_POINTS,
  LINE_EXACT_MAX_POINTS,
  LINE_KEYBOARD_PAN_RATIO,
  toSafeInteger,
  clamp,
  normalizeLineQuality,
  formatCell,
  measureAxisLabelWidth,
} from "../shared.js";
import { buildLineSelectionKey } from "../render/config.js";
import { LINE_RUNTIME_CLEANUPS, setMatrixStatus } from "./common.js";
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
  const fileEtag = shell.dataset.lineFileEtag || "";
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
    fileEtag,
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

  function getSvgDimensions() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, Math.round(rect.width) || LINE_SVG_WIDTH);
    const h = Math.max(200, Math.round(rect.height) || LINE_SVG_HEIGHT);
    return { width: w, height: h };
  }

  function renderSeries(points) {
    const { width, height } = getSvgDimensions();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
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

    if (runtime.fileEtag) {
      params.etag = runtime.fileEtag;
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

  /* ResizeObserver — re-render chart when container resizes */
  let resizeTimer = null;
  const resizeObserver = new ResizeObserver(() => {
    if (runtime.destroyed) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!runtime.destroyed && runtime.points && runtime.points.length >= 2) {
        renderSeries(runtime.points);
      }
    }, 150);
  });
  resizeObserver.observe(canvas);

  const cleanup = () => {
    persistViewState();
    runtime.destroyed = true;
    hideHover();
    resizeObserver.disconnect();
    clearTimeout(resizeTimer);
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

export { initializeLineRuntime };
