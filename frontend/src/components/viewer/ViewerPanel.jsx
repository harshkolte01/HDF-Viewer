import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './ViewerPanel.css';

const formatValue = (value) => {
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
};

const formatNumber = (value, notation = 'auto') => {
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
};

const formatAxisNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  const rounded = Math.round(number);
  if (Math.abs(number - rounded) < 1e-6) {
    return String(rounded);
  }
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatCell = (value, notation) => {
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
};

const formatTypeDescription = (typeInfo) => {
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
};

const normalizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
const getArrayEdge = (array, index, fallback = 'na') => {
  if (!Array.isArray(array) || array.length === 0) return fallback;
  const value = array[index < 0 ? array.length + index : index];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
};
const buildAxisTicks = (size, maxTicks = 9) => {
  const length = Number(size) || 0;
  if (length <= 0) return [];
  if (length === 1) return [0];

  const target = Math.max(2, Math.min(maxTicks, length));
  const ticks = new Set([0, length - 1]);
  for (let i = 1; i < target - 1; i += 1) {
    const value = Math.round((i / (target - 1)) * (length - 1));
    ticks.add(value);
  }
  return Array.from(ticks).sort((a, b) => a - b);
};

const buildLineChartResetKey = (selectedPath, series, lineData) => {
  const x = Array.isArray(series?.x) ? series.x : [];
  const y = Array.isArray(series?.y) ? series.y : [];
  const step = Number(lineData?.downsample_info?.step);
  const offset = Number(lineData?.line_offset);
  return [
    selectedPath || 'no-path',
    y.length,
    x.length,
    getArrayEdge(x, 0),
    getArrayEdge(x, -1),
    getArrayEdge(y, 0),
    getArrayEdge(y, -1),
    Number.isFinite(step) ? step : 'na',
    Number.isFinite(offset) ? offset : 'na'
  ].join('|');
};

const getLineSeries = (preview, lineData) => {
  if (lineData?.data && Array.isArray(lineData.data)) {
    const step = Number(lineData.downsample_info?.step) || 1;
    const offset = Number.isFinite(Number(lineData.line_offset)) ? Number(lineData.line_offset) : 0;
    return {
      type: 'line',
      x: lineData.data.map((_, idx) => offset + idx * step),
      y: lineData.data
    };
  }
  if (!preview) return null;
  if (preview.plot?.type === 'line') {
    return preview.plot;
  }
  if (preview.profile?.x && preview.profile?.y) {
    return {
      type: 'line',
      x: preview.profile.x,
      y: preview.profile.y
    };
  }
  return null;
};

const buildLinePoints = (series) => {
  if (!series || !Array.isArray(series.y)) return [];
  return series.y.map((value, index) => ({
    index,
    x: Number.isFinite(Number(series.x?.[index])) ? Number(series.x?.[index]) : index,
    y: normalizeNumber(value)
  })).filter((point) => point.y !== null);
};

const MATRIX_ROW_HEIGHT = 28;
const MATRIX_COL_WIDTH = 96;
const MATRIX_HEADER_HEIGHT = 28;
const MATRIX_INDEX_WIDTH = 60;
const MATRIX_OVERSCAN = 4;
const HEATMAP_COLORMAPS = {
  viridis: [
    [0.267, 0.004, 0.329], [0.282, 0.140, 0.457], [0.253, 0.265, 0.529],
    [0.206, 0.371, 0.553], [0.163, 0.471, 0.558], [0.127, 0.566, 0.550],
    [0.134, 0.658, 0.517], [0.266, 0.748, 0.441], [0.477, 0.821, 0.318],
    [0.741, 0.873, 0.149], [0.993, 0.906, 0.143]
  ],
  plasma: [
    [0.050, 0.030, 0.529], [0.258, 0.013, 0.615], [0.417, 0.006, 0.659],
    [0.550, 0.044, 0.667], [0.663, 0.108, 0.643], [0.763, 0.178, 0.593],
    [0.848, 0.255, 0.530], [0.916, 0.340, 0.449], [0.966, 0.435, 0.354],
    [0.992, 0.549, 0.235], [0.987, 0.680, 0.079]
  ],
  inferno: [
    [0.001, 0.000, 0.014], [0.116, 0.023, 0.109], [0.258, 0.013, 0.208],
    [0.408, 0.038, 0.267], [0.550, 0.089, 0.282], [0.683, 0.163, 0.264],
    [0.798, 0.255, 0.224], [0.888, 0.368, 0.162], [0.951, 0.498, 0.074],
    [0.988, 0.645, 0.039], [0.988, 0.807, 0.144]
  ],
  magma: [
    [0.001, 0.000, 0.014], [0.116, 0.021, 0.111], [0.258, 0.017, 0.210],
    [0.408, 0.044, 0.269], [0.550, 0.096, 0.285], [0.683, 0.170, 0.267],
    [0.798, 0.263, 0.227], [0.888, 0.375, 0.167], [0.951, 0.506, 0.079],
    [0.988, 0.652, 0.042], [0.987, 0.991, 0.749]
  ],
  cool: [
    [0.000, 1.000, 1.000], [0.125, 0.875, 1.000], [0.250, 0.750, 1.000],
    [0.375, 0.625, 1.000], [0.500, 0.500, 1.000], [0.625, 0.375, 1.000],
    [0.750, 0.250, 1.000], [0.875, 0.125, 1.000], [1.000, 0.000, 1.000]
  ],
  hot: [
    [0.000, 0.000, 0.000], [0.333, 0.000, 0.000], [0.667, 0.000, 0.000],
    [1.000, 0.000, 0.000], [1.000, 0.333, 0.000], [1.000, 0.667, 0.000],
    [1.000, 1.000, 0.000], [1.000, 1.000, 0.333], [1.000, 1.000, 0.667],
    [1.000, 1.000, 1.000]
  ]
};

function VirtualMatrixTable({
  rows,
  cols,
  blockRows,
  blockCols,
  getBlock,
  onRequestBlock,
  notation,
  cacheVersion
}) {
  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    scrollTop: 0,
    scrollLeft: 0
  });

  const updateViewport = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = {
      width: container.clientWidth,
      height: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft
    };
    setViewport((current) => (
      current.width === next.width
      && current.height === next.height
      && current.scrollTop === next.scrollTop
      && current.scrollLeft === next.scrollLeft
        ? current
        : next
    ));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const queueViewportUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        updateViewport();
      });
    };

    updateViewport();

    container.addEventListener('scroll', queueViewportUpdate, { passive: true });

    const resizeObserver = new ResizeObserver(queueViewportUpdate);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', queueViewportUpdate);
      resizeObserver.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [updateViewport]);

  useEffect(() => {
    if (rows <= 0 || cols <= 0) return;
    const contentScrollTop = Math.max(0, viewport.scrollTop - MATRIX_HEADER_HEIGHT);
    const contentScrollLeft = Math.max(0, viewport.scrollLeft - MATRIX_INDEX_WIDTH);
    const contentHeight = Math.max(0, viewport.height - MATRIX_HEADER_HEIGHT);
    const contentWidth = Math.max(0, viewport.width - MATRIX_INDEX_WIDTH);

    const visibleRowStart = Math.max(0, Math.floor(contentScrollTop / MATRIX_ROW_HEIGHT) - MATRIX_OVERSCAN);
    const visibleRowEnd = Math.min(
      rows - 1,
      Math.floor((contentScrollTop + contentHeight) / MATRIX_ROW_HEIGHT) + MATRIX_OVERSCAN
    );
    const visibleColStart = Math.max(0, Math.floor(contentScrollLeft / MATRIX_COL_WIDTH) - MATRIX_OVERSCAN);
    const visibleColEnd = Math.min(
      cols - 1,
      Math.floor((contentScrollLeft + contentWidth) / MATRIX_COL_WIDTH) + MATRIX_OVERSCAN
    );

    const blockRowStart = Math.floor(visibleRowStart / blockRows) * blockRows;
    const blockRowEnd = Math.floor(visibleRowEnd / blockRows) * blockRows;
    const blockColStart = Math.floor(visibleColStart / blockCols) * blockCols;
    const blockColEnd = Math.floor(visibleColEnd / blockCols) * blockCols;

    for (let row = blockRowStart; row <= blockRowEnd; row += blockRows) {
      const rowLimit = Math.min(blockRows, rows - row);
      for (let col = blockColStart; col <= blockColEnd; col += blockCols) {
        const colLimit = Math.min(blockCols, cols - col);
        onRequestBlock?.(row, col, rowLimit, colLimit);
      }
    }
  }, [rows, cols, blockRows, blockCols, viewport, onRequestBlock]);

  const contentScrollTop = Math.max(0, viewport.scrollTop - MATRIX_HEADER_HEIGHT);
  const contentScrollLeft = Math.max(0, viewport.scrollLeft - MATRIX_INDEX_WIDTH);
  const contentHeight = Math.max(0, viewport.height - MATRIX_HEADER_HEIGHT);
  const contentWidth = Math.max(0, viewport.width - MATRIX_INDEX_WIDTH);

  const visibleRowStart = Math.max(0, Math.floor(contentScrollTop / MATRIX_ROW_HEIGHT) - MATRIX_OVERSCAN);
  const visibleRowEnd = Math.min(
    rows - 1,
    Math.floor((contentScrollTop + contentHeight) / MATRIX_ROW_HEIGHT) + MATRIX_OVERSCAN
  );
  const visibleColStart = Math.max(0, Math.floor(contentScrollLeft / MATRIX_COL_WIDTH) - MATRIX_OVERSCAN);
  const visibleColEnd = Math.min(
    cols - 1,
    Math.floor((contentScrollLeft + contentWidth) / MATRIX_COL_WIDTH) + MATRIX_OVERSCAN
  );

  const visibleRows = [];
  for (let row = visibleRowStart; row <= visibleRowEnd; row += 1) {
    visibleRows.push(row);
  }

  const visibleCols = [];
  for (let col = visibleColStart; col <= visibleColEnd; col += 1) {
    visibleCols.push(col);
  }

  const getCellValue = (row, col) => {
    const rowBase = Math.floor(row / blockRows) * blockRows;
    const colBase = Math.floor(col / blockCols) * blockCols;
    const rowLimit = Math.min(blockRows, rows - rowBase);
    const colLimit = Math.min(blockCols, cols - colBase);
    const block = getBlock?.(rowBase, colBase, rowLimit, colLimit);
    if (!block || !Array.isArray(block.data)) return null;
    const localRow = row - block.row_offset;
    const localCol = col - block.col_offset;
    return block.data?.[localRow]?.[localCol] ?? null;
  };

  const totalWidth = MATRIX_INDEX_WIDTH + cols * MATRIX_COL_WIDTH;
  const totalHeight = MATRIX_HEADER_HEIGHT + rows * MATRIX_ROW_HEIGHT;

  return (
    <div className="matrix-table-shell">
      <div className="matrix-table" ref={containerRef}>
        <div
          className="matrix-spacer"
          style={{ width: totalWidth, height: totalHeight }}
        />
        <div className="matrix-header" style={{ width: totalWidth, height: MATRIX_HEADER_HEIGHT }}>
          <div className="matrix-header-corner" style={{ width: MATRIX_INDEX_WIDTH }} />
          <div className="matrix-header-cells" style={{ width: cols * MATRIX_COL_WIDTH }}>
            {visibleCols.map((col) => (
              <div
                key={`header-${col}`}
                className="matrix-cell matrix-cell-header"
                style={{
                  left: col * MATRIX_COL_WIDTH,
                  width: MATRIX_COL_WIDTH,
                  height: MATRIX_HEADER_HEIGHT
                }}
              >
                {col}
              </div>
            ))}
          </div>
        </div>
        <div
          className="matrix-index"
          style={{
            height: rows * MATRIX_ROW_HEIGHT,
            width: MATRIX_INDEX_WIDTH,
            transform: `translateY(${-viewport.scrollTop}px)`
          }}
        >
          {visibleRows.map((row) => (
            <div
              key={`row-${row}`}
              className="matrix-cell matrix-cell-index"
              style={{
                top: row * MATRIX_ROW_HEIGHT,
                width: MATRIX_INDEX_WIDTH,
                height: MATRIX_ROW_HEIGHT
              }}
            >
              {row}
            </div>
          ))}
        </div>
        <div className="matrix-cells" style={{ width: cols * MATRIX_COL_WIDTH, height: rows * MATRIX_ROW_HEIGHT }}>
          {visibleRows.map((row) => (
            visibleCols.map((col) => {
              const value = getCellValue(row, col);
              return (
                <div
                  key={`cell-${row}-${col}-${cacheVersion}`}
                  className="matrix-cell"
                  style={{
                    top: row * MATRIX_ROW_HEIGHT,
                    left: col * MATRIX_COL_WIDTH,
                    width: MATRIX_COL_WIDTH,
                    height: MATRIX_ROW_HEIGHT
                  }}
                >
                  {value === null ? '--' : formatCell(value, notation)}
                </div>
              );
            })
          ))}
        </div>
      </div>
    </div>
  );
}

function LineChart({ series, notation, gridEnabled, aspectMode, onViewChange }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const rawClipId = useId();
  const clipId = useMemo(() => `line-clip-${rawClipId.replace(/:/g, '')}`, [rawClipId]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hover, setHover] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewChangeRef = useRef(null);

  const points = useMemo(() => buildLinePoints(series), [series]);
  const hasPoints = points.length > 0;

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const rawMinX = hasPoints ? Math.min(...points.map((point) => point.x)) : 0;
  const rawMaxX = hasPoints ? Math.max(...points.map((point) => point.x)) : 1;
  const rawMinY = hasPoints ? Math.min(...points.map((point) => point.y)) : 0;
  const rawMaxY = hasPoints ? Math.max(...points.map((point) => point.y)) : 1;
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

  const width = 760;
  const height = 320;
  const minZoom = 1;
  const maxZoom = 6;
  const padding = 28;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const getPanBounds = useCallback((scale) => {
    const leftBound = padding - padding * scale;
    const rightBound = (padding + chartW) - (padding + chartW) * scale;
    const topBound = padding - padding * scale;
    const bottomBound = (padding + chartH) - (padding + chartH) * scale;

    if (scale >= 1) {
      return {
        minX: rightBound,
        maxX: leftBound,
        minY: bottomBound,
        maxY: topBound
      };
    }

    return {
      minX: leftBound,
      maxX: rightBound,
      minY: topBound,
      maxY: bottomBound
    };
  }, [chartH, chartW, padding]);

  const clampPan = useCallback((nextPan, scale) => {
    const bounds = getPanBounds(scale);
    return {
      x: clampValue(nextPan.x, bounds.minX, bounds.maxX),
      y: clampValue(nextPan.y, bounds.minY, bounds.maxY)
    };
  }, [getPanBounds]);

  const toChartPoint = (point) => ({
    x: padding + ((point.x - minX) / spanX) * chartW,
    y: padding + chartH - ((point.y - minY) / spanY) * chartH
  });

  const path = points
    .map((point, index) => {
      const { x, y } = toChartPoint(point);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const gridLines = Array.from({ length: 6 }).map((_, idx) => {
    const ratio = idx / 5;
    return {
      ratio,
      x: padding + ratio * chartW,
      y: padding + ratio * chartH
    };
  });

  const sampleStep = points.length > 2000 ? Math.ceil(points.length / 2000) : 1;
  const resolvedAspect = aspectMode || 'line';
  const shouldShowLine = resolvedAspect === 'line' || resolvedAspect === 'both';
  const shouldShowPoints = resolvedAspect === 'point' || resolvedAspect === 'both';

  const applyZoom = useCallback((nextZoom, center) => {
    const clamped = clampValue(nextZoom, minZoom, maxZoom);
    if (clamped === zoom) return;
    const scale = clamped / zoom;
    setPan((current) => {
      const nextPan = center
        ? {
            x: center.x - scale * (center.x - current.x),
            y: center.y - scale * (center.y - current.y)
          }
        : current;
      return clampPan(nextPan, clamped);
    });
    setZoom(clamped);
  }, [clampPan, maxZoom, minZoom, zoom]);

  const getViewPoint = useCallback((event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return { x, y };
  }, [height, width]);

  const handleWheel = useCallback((event) => {
    if (!svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getViewPoint(event);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(zoom * delta, point || { x: width / 2, y: height / 2 });
  }, [applyZoom, getViewPoint, height, width, zoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const listener = (event) => handleWheel(event);
    svg.addEventListener('wheel', listener, { passive: false });
    return () => {
      svg.removeEventListener('wheel', listener);
    };
  }, [handleWheel]);

  const handleMouseDown = (event) => {
    if (!panEnabled) return;
    const point = getViewPoint(event);
    if (!point) return;
    setIsPanning(true);
    dragRef.current = point;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    dragRef.current = null;
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setHover(null);
  };

  const handleMouseMove = (event) => {
    const point = getViewPoint(event);
    if (!point) return;

    if (panEnabled && isPanning && dragRef.current) {
      const dx = point.x - dragRef.current.x;
      const dy = point.y - dragRef.current.y;
      setPan((current) => clampPan({
        x: current.x + dx,
        y: current.y + dy
      }, zoom));
      dragRef.current = point;
      return;
    }

    const baseX = (point.x - pan.x) / zoom;
    const baseY = (point.y - pan.y) / zoom;
    const ratioX = (baseX - padding) / chartW;
    const ratioY = (baseY - padding) / chartH;
    if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) {
      setHover(null);
      return;
    }

    const approxIndex = clampValue(
      Math.round(ratioX * (points.length - 1)),
      0,
      points.length - 1
    );
    const target = points[approxIndex];
    const basePoint = toChartPoint(target);
    const markerX = basePoint.x * zoom + pan.x;
    const markerY = basePoint.y * zoom + pan.y;

    setHover({
      index: target.index,
      x: target.x,
      y: target.y,
      cx: markerX,
      cy: markerY
    });
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(minZoom);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  const getAxisValueX = useCallback((screenX) => {
    const baseX = (screenX - pan.x) / zoom;
    const ratio = (baseX - padding) / chartW;
    return minX + ratio * spanX;
  }, [chartW, minX, padding, pan.x, spanX, zoom]);

  const getAxisValueY = useCallback((screenY) => {
    const baseY = (screenY - pan.y) / zoom;
    const ratio = (baseY - padding) / chartH;
    return maxY - ratio * spanY;
  }, [chartH, maxY, padding, pan.y, spanY, zoom]);

  useEffect(() => {
    if (!onViewChange || zoom <= 1) return;
    const start = getAxisValueX(padding);
    const end = getAxisValueX(padding + chartW);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const range = {
      start: Math.min(start, end),
      end: Math.max(start, end)
    };
    if (viewChangeRef.current) {
      clearTimeout(viewChangeRef.current);
    }
    viewChangeRef.current = setTimeout(() => {
      onViewChange(range);
    }, 200);
  }, [chartW, getAxisValueX, onViewChange, padding, zoom]);

  useEffect(() => () => {
    if (viewChangeRef.current) {
      clearTimeout(viewChangeRef.current);
    }
  }, []);

  if (!hasPoints) {
    return (
      <div className="panel-state">
        <div className="state-text">Line preview not available.</div>
      </div>
    );
  }

  return (
    <div className={`line-chart-shell ${isFullscreen ? 'is-fullscreen' : ''}`} ref={containerRef}>
      <div className="line-chart-toolbar">
        <div className="line-tool-group">
          <button
            type="button"
            className={`line-tool-btn ${panEnabled ? 'active' : ''}`}
            onClick={() => setPanEnabled((value) => !value)}
          >
            Hand
          </button>
          <button type="button" className="line-tool-btn" onClick={() => applyZoom(zoom * 1.15)}>
            Zoom +
          </button>
          <button type="button" className="line-tool-btn" onClick={() => applyZoom(zoom / 1.15)}>
            Zoom -
          </button>
          <button type="button" className="line-tool-btn" onClick={resetView}>
            Reset
          </button>
        </div>
        <div className="line-tool-group">
          <span className="line-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="line-tool-btn" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div className="line-chart-stage">
        <svg
          ref={svgRef}
          className={`line-chart-canvas ${panEnabled ? 'is-pan' : ''} ${isPanning ? 'is-grabbing' : ''}`}
          viewBox={`0 0 ${width} ${height}`}
          overflow="hidden"
          role="img"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
        >
          <rect className="line-chart-bg" x="0" y="0" width={width} height={height} />
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect x={padding} y={padding} width={chartW} height={chartH} />
            </clipPath>
          </defs>
          <g className="line-axes">
            <line className="line-axis" x1={padding} y1={padding} x2={padding} y2={padding + chartH} />
            <line
              className="line-axis"
              x1={padding}
              y1={padding + chartH}
              x2={padding + chartW}
              y2={padding + chartH}
            />
          </g>
          <g className="line-axis-labels">
            {gridLines.map((line, idx) => {
              const xValue = getAxisValueX(line.x);
              return (
                <text
                  key={`x-label-${idx}`}
                  x={line.x}
                  y={padding + chartH + 18}
                  textAnchor="middle"
                >
                  {formatAxisNumber(xValue)}
                </text>
              );
            })}
            {gridLines.map((line, idx) => {
              const yValue = getAxisValueY(line.y);
              return (
                <text
                  key={`y-label-${idx}`}
                  x={padding - 8}
                  y={line.y + 4}
                  textAnchor="end"
                >
                  {formatNumber(yValue, notation)}
                </text>
              );
            })}
          </g>
          {gridEnabled && (
            <g className="line-grid" clipPath={`url(#${clipId})`}>
              {gridLines.map((line, idx) => (
                <line
                  key={`grid-x-${idx}`}
                  x1={line.x}
                  y1={padding}
                  x2={line.x}
                  y2={padding + chartH}
                />
              ))}
              {gridLines.map((line, idx) => (
                <line
                  key={`grid-y-${idx}`}
                  x1={padding}
                  y1={line.y}
                  x2={padding + chartW}
                  y2={line.y}
                />
              ))}
            </g>
          )}
          <g clipPath={`url(#${clipId})`}>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {shouldShowLine && <path className="line-path" d={path} vectorEffect="non-scaling-stroke" />}
              {shouldShowPoints && (
                <g className="line-points">
                  {points.filter((_, idx) => idx % sampleStep === 0).map((point) => {
                    const { x, y } = toChartPoint(point);
                    return <circle key={`pt-${point.index}`} cx={x} cy={y} r="3" />;
                  })}
                </g>
              )}
            </g>
          </g>
          {hover && (
            <g clipPath={`url(#${clipId})`}>
              <circle className="line-hover-dot" cx={hover.cx} cy={hover.cy} r="4" />
            </g>
          )}
        </svg>
        {hover && (
          <div className="line-hover">
            <div>Index: {formatNumber(hover.x, 'exact')}</div>
            <div>Value: {formatNumber(hover.y, notation)}</div>
          </div>
        )}
      </div>
      <div className="line-stats">
        <span>Min: {formatNumber(rawMinY, notation)}</span>
        <span>Max: {formatNumber(rawMaxY, notation)}</span>
      </div>
    </div>
  );
}

const renderTable = (preview, notation) => {
  if (!preview?.table) {
    return (
      <div className="panel-state">
        <div className="state-text">Table preview not available.</div>
      </div>
    );
  }

  if (preview.table.kind === '1d') {
    return (
      <div className="preview-table-wrapper">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {preview.table.values.map((value, index) => (
              <tr key={index}>
                <td>{index}</td>
                <td>{formatCell(value, notation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (preview.table.kind === '2d') {
    const data = preview.table.data || [];
    const cols = data[0]?.length || 0;
    return (
      <div className="preview-table-wrapper">
        <table className="preview-table">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx}>{idx}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="row-index">{rowIndex}</td>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{formatCell(cell, notation)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="panel-state">
      <div className="state-text">Table preview not available.</div>
    </div>
  );
};

const renderHeatmap = (preview, heatmapPayload, heatmapColormap, heatmapGrid, onHeatmapZoom) => {
  const source = (
    Array.isArray(heatmapPayload?.data)
    || Array.isArray(heatmapPayload?.values)
  ) ? heatmapPayload : null;
  if (!preview && !source) {
    return (
      <div className="panel-state">
        <div className="state-text">Heatmap data not available.</div>
      </div>
    );
  }

  const ndim = source?.source_ndim ?? preview?.ndim ?? 0;
  if (ndim < 2) {
    return (
      <div className="panel-state">
        <div className="state-text">Heatmap requires 2D or higher dimensional data.</div>
      </div>
    );
  }

  let heatmapData = null;
  let stats = source?.stats || null;

  if (Array.isArray(source?.data)) {
    heatmapData = source.data;
  } else if (Array.isArray(source?.values)) {
    heatmapData = source.values;
  } else if (preview?.plot?.type === 'heatmap' && preview.plot?.data) {
    heatmapData = preview.plot.data;
  } else if (preview?.table?.kind === '2d' && preview.table?.data) {
    heatmapData = preview.table.data;
  } else if (Array.isArray(preview?.data)) {
    heatmapData = preview.data;
  }

  if (!stats && preview?.stats?.supported) {
    stats = {
      min: preview.stats.min,
      max: preview.stats.max
    };
  }
  if (!stats && Number.isFinite(Number(source?.vmin)) && Number.isFinite(Number(source?.vmax))) {
    stats = {
      min: Number(source.vmin),
      max: Number(source.vmax)
    };
  }

  if (!heatmapData || !Array.isArray(heatmapData) || !Array.isArray(heatmapData[0])) {
    return (
      <div className="panel-state">
        <div className="state-text">No valid 2D data available for heatmap visualization.</div>
      </div>
    );
  }

  const rows = heatmapData.length;
  const cols = Array.isArray(heatmapData[0]) ? heatmapData[0].length : 0;
  const heatmapResetKey = [
    source?.source_path || preview?.path || preview?.name || 'heatmap',
    rows,
    cols,
    stats?.min ?? 'na',
    stats?.max ?? 'na',
    getArrayEdge(heatmapData[0], 0),
    getArrayEdge(heatmapData[rows - 1], cols - 1)
  ].join('|');

  return (
    <div className="preview-heatmap">
      <HeatmapChart
        key={heatmapResetKey}
        data={heatmapData}
        stats={stats}
        colormap={heatmapColormap}
        showGrid={heatmapGrid}
        onZoom={onHeatmapZoom}
      />
    </div>
  );
};

function HeatmapChart({ data, stats: statsOverride, colormap = 'viridis', showGrid = true, onZoom }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const rawClipId = useId();
  const clipId = useMemo(() => `heatmap-clip-${rawClipId.replace(/:/g, '')}`, [rawClipId]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panEnabled, setPanEnabled] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [hover, setHover] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const zoomChangeRef = useRef(null);

  // Calculate data statistics and setup
  const stats = useMemo(() => {
    if (!data || !Array.isArray(data)) return { min: 0, max: 1, rows: 0, cols: 0 };
    const rows = data.length;
    const cols = data[0]?.length || 0;
    if (rows === 0 || cols === 0) return { min: 0, max: 1, rows: 0, cols: 0 };

    let min = Number(statsOverride?.min);
    let max = Number(statsOverride?.max);
    const hasOverride = Number.isFinite(min) && Number.isFinite(max);

    if (!hasOverride) {
      const flat = data.flat().filter((value) => Number.isFinite(Number(value)));
      if (flat.length === 0) return { min: 0, max: 1, rows, cols };
      const numbers = flat.map(Number);
      min = Math.min(...numbers);
      max = Math.max(...numbers);
    }

    const resolvedMax = max === min ? min + 1 : max;
    return { min, max: resolvedMax, rows, cols };
  }, [data, statsOverride]);
  const colorStops = useMemo(
    () => HEATMAP_COLORMAPS[colormap] || HEATMAP_COLORMAPS.viridis,
    [colormap]
  );
  const xTicks = useMemo(() => buildAxisTicks(stats.cols), [stats.cols]);
  const yTicks = useMemo(() => buildAxisTicks(stats.rows), [stats.rows]);

  useEffect(() => {
    if (!onZoom || zoom <= 1) return;
    if (zoomChangeRef.current) {
      clearTimeout(zoomChangeRef.current);
    }
    zoomChangeRef.current = setTimeout(() => {
      onZoom(zoom);
    }, 200);
  }, [zoom, onZoom]);

  useEffect(() => () => {
    if (zoomChangeRef.current) {
      clearTimeout(zoomChangeRef.current);
    }
  }, []);

  // Get color from colormap
  const getColor = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '#CBD5E1';
    }
    
    const normalized = stats.max === stats.min ? 0 : (numeric - stats.min) / (stats.max - stats.min);
    const clamped = Math.max(0, Math.min(1, normalized));
    const index = clamped * (colorStops.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;
    
    if (lower === upper) {
      const [r, g, b] = colorStops[lower];
      return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    
    const [r1, g1, b1] = colorStops[lower];
    const [r2, g2, b2] = colorStops[upper];
    return `rgb(${Math.round((r1 + (r2 - r1) * fraction) * 255)}, ${Math.round((g1 + (g2 - g1) * fraction) * 255)}, ${Math.round((b1 + (b2 - b1) * fraction) * 255)})`;
  }, [colorStops, stats]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const width = 760;
  const height = 420;
  const minZoom = 1;
  const maxZoom = 6;
  const padding = 50;
  const chartW = width - padding * 2 - 80; // Extra space for color bar
  const chartH = height - padding * 2;
  const safeCols = Math.max(1, stats.cols);
  const safeRows = Math.max(1, stats.rows);
  const cellWidth = chartW / safeCols;
  const cellHeight = chartH / safeRows;

  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

  const getPanBounds = useCallback((scale) => {
    // Calculate the scaled chart dimensions
    const scaledW = chartW * scale;
    const scaledH = chartH * scale;
    
    // Calculate bounds to keep the scaled chart within the viewport
    const maxPanX = Math.max(0, scaledW - chartW);
    const maxPanY = Math.max(0, scaledH - chartH);
    
    return {
      minX: -maxPanX,
      maxX: 0,
      minY: -maxPanY,
      maxY: 0
    };
  }, [chartH, chartW]);

  const clampPan = useCallback((targetPan, scale) => {
    const bounds = getPanBounds(scale);
    return {
      x: clampValue(targetPan.x, bounds.minX, bounds.maxX),
      y: clampValue(targetPan.y, bounds.minY, bounds.maxY)
    };
  }, [getPanBounds]);

  const applyZoom = useCallback((targetZoom, anchor = null) => {
    const clamped = clampValue(targetZoom, minZoom, maxZoom);
    if (Math.abs(clamped - zoom) < 0.01) return;
    
    setPan((current) => {
      let nextPan = current;
      
      if (anchor) {
        // Only zoom around anchor if it's within the chart area
        const isInChart = anchor.x >= padding && anchor.x <= padding + chartW &&
                         anchor.y >= padding && anchor.y <= padding + chartH;
        
        if (isInChart) {
          // Calculate the chart-relative anchor point
          const chartRelativeX = anchor.x - padding;
          const chartRelativeY = anchor.y - padding;
          
          // Apply zoom around this point
          const scale = clamped / zoom;
          nextPan = {
            x: current.x - chartRelativeX * (scale - 1),
            y: current.y - chartRelativeY * (scale - 1)
          };
        }
      }
      
      return clampPan(nextPan, clamped);
    });
    setZoom(clamped);
  }, [chartH, chartW, clampPan, maxZoom, minZoom, padding, zoom]);

  const getViewPoint = useCallback((event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return { x, y };
  }, [height, width]);

  const handleWheel = useCallback((event) => {
    if (!svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getViewPoint(event);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(zoom * delta, point || { x: width / 2, y: height / 2 });
  }, [applyZoom, getViewPoint, height, width, zoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const listener = (event) => handleWheel(event);
    svg.addEventListener('wheel', listener, { passive: false });
    return () => {
      svg.removeEventListener('wheel', listener);
    };
  }, [handleWheel]);

  const handleMouseDown = (event) => {
    if (!panEnabled) return;
    const point = getViewPoint(event);
    if (!point) return;
    setIsPanning(true);
    dragRef.current = point;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    dragRef.current = null;
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setHover(null);
  };

  const handleMouseMove = (event) => {
    const point = getViewPoint(event);
    if (!point) return;

    if (panEnabled && isPanning && dragRef.current) {
      const dx = point.x - dragRef.current.x;
      const dy = point.y - dragRef.current.y;
      setPan((current) => clampPan({
        x: current.x + dx,
        y: current.y + dy
      }, zoom));
      dragRef.current = point;
      return;
    }

    // Calculate hover position
    const baseX = (point.x - pan.x) / zoom;
    const baseY = (point.y - pan.y) / zoom;
    const ratioX = (baseX - padding) / chartW;
    const ratioY = (baseY - padding) / chartH;
    
    if (ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1) {
      setHover(null);
      return;
    }

    const col = clampValue(Math.floor(ratioX * stats.cols), 0, stats.cols - 1);
    const row = clampValue(Math.floor(ratioY * stats.rows), 0, stats.rows - 1);
    
    const value = data[row] && data[row][col] !== undefined ? Number(data[row][col]) : null;
    setHover({ row, col, value });
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(minZoom);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  const formatScaleValue = (value) => {
    if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-3 && value !== 0)) {
      return value.toExponential(2);
    }
    return value.toFixed(Math.abs(value) >= 10 ? 1 : 2);
  };

  if (!data || stats.rows === 0 || stats.cols === 0) {
    return (
      <div className="panel-state">
        <div className="state-text">No valid heatmap data available.</div>
      </div>
    );
  }

  return (
    <div className={`line-chart-shell heatmap-chart-shell ${isFullscreen ? 'is-fullscreen' : ''}`} ref={containerRef}>
      <div className="line-chart-toolbar heatmap-chart-toolbar">
        <div className="line-tool-group">
          <button
            type="button"
            className={`line-tool-btn ${panEnabled ? 'active' : ''}`}
            onClick={() => setPanEnabled((value) => !value)}
          >
            Hand
          </button>
          <button type="button" className="line-tool-btn" onClick={() => applyZoom(zoom * 1.15)}>
            Zoom +
          </button>
          <button type="button" className="line-tool-btn" onClick={() => applyZoom(zoom / 1.15)}>
            Zoom -
          </button>
          <button type="button" className="line-tool-btn" onClick={resetView}>
            Reset
          </button>
        </div>
        <div className="line-tool-group">
          <span className="line-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="line-tool-btn" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div className="line-chart-stage">
        <svg
          ref={svgRef}
          className={`line-chart-canvas heatmap-chart-canvas ${panEnabled ? 'is-pan' : ''} ${isPanning ? 'is-grabbing' : ''}`}
          viewBox={`0 0 ${width} ${height}`}
          overflow="hidden"
          role="img"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={padding} y={padding} width={chartW} height={chartH} />
            </clipPath>
            {/* Color gradient definition */}
            <linearGradient id={`colorscale-${clipId}`} x1="0%" y1="100%" x2="0%" y2="0%">
              {colorStops.map(([r, g, b], index) => (
                <stop
                  key={index}
                  offset={`${(index / (colorStops.length - 1)) * 100}%`}
                  stopColor={`rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`}
                />
              ))}
            </linearGradient>
          </defs>
          
          {/* Fixed chart border */}
          <rect
            x={padding}
            y={padding}
            width={chartW}
            height={chartH}
            fill="none"
            stroke="#D9E2F2"
            strokeWidth="2"
          />
          
          {/* Zoomable heatmap content */}
          <g clipPath={`url(#${clipId})`}>
            <g transform={`translate(${padding + pan.x}, ${padding + pan.y}) scale(${zoom})`}>
              {/* Heatmap cells */}
              {data.map((row, rowIdx) =>
                row.map((value, colIdx) => (
                  <rect
                    key={`${rowIdx}-${colIdx}`}
                    x={colIdx * cellWidth}
                    y={rowIdx * cellHeight}
                    width={cellWidth}
                    height={cellHeight}
                    fill={getColor(value)}
                    stroke={showGrid || (hover?.row === rowIdx && hover?.col === colIdx) ? '#ffffff' : 'none'}
                    strokeWidth={(showGrid ? 0.5 : 0) + (hover?.row === rowIdx && hover?.col === colIdx ? (1.2 / zoom) : 0)}
                    strokeOpacity={hover?.row === rowIdx && hover?.col === colIdx ? 0.95 : 0.5}
                  />
                ))
              )}
            </g>
          </g>

          {/* Fixed axes (not affected by zoom/pan) */}
          <g fill="#0F172A" fontSize="11">
            {/* X-axis labels */}
            {xTicks.map((col) => (
              <text
                key={`x-${col}`}
                x={padding + (col + 0.5) * cellWidth}
                y={padding + chartH + 16}
                textAnchor="middle"
                fill="#0F172A"
              >
                {col}
              </text>
            ))}
            
            {/* Y-axis labels */}
            {yTicks.map((row) => (
              <text
                key={`y-${row}`}
                x={padding - 10}
                y={padding + (row + 0.5) * cellHeight + 4}
                textAnchor="end"
                fill="#0F172A"
              >
                {row}
              </text>
            ))}

            {/* Axis titles */}
            <text x={padding + (chartW / 2)} y={height - 10} textAnchor="middle" fontSize="13" fontWeight="500">
              Column Index
            </text>
            <text
              x={20}
              y={padding + (chartH / 2)}
              textAnchor="middle"
              fontSize="13"
              fontWeight="500"
              transform={`rotate(-90, 20, ${padding + (chartH / 2)})`}
            >
              Row Index
            </text>
          </g>

          {/* Color scale bar (outside transform) */}
          <g>
            <rect
              x={width - 70}
              y={padding}
              width={20}
              height={chartH}
              fill={`url(#colorscale-${clipId})`}
              stroke="#D9E2F2"
              strokeWidth="1"
            />
            
            {/* Color scale labels */}
            <g fill="#0F172A" fontSize="10">
              <text x={width - 45} y={padding + 5} textAnchor="start">
                {formatScaleValue(stats.max)}
              </text>
              <text x={width - 45} y={padding + chartH} textAnchor="start">
                {formatScaleValue(stats.min)}
              </text>
              <text x={width - 45} y={padding + chartH / 2} textAnchor="start">
                {formatScaleValue((stats.min + stats.max) / 2)}
              </text>
            </g>
          </g>

          {/* Hover tooltip */}
          {hover && (
            <g>
              <rect
                x={10}
                y={10}
                width={120}
                height={50}
                fill="#FFFFFF"
                stroke="#D9E2F2"
                strokeWidth="1"
                rx="4"
                opacity="0.95"
              />
              <text x={16} y={25} fontSize="10" fill="#0F172A">
                Row: {hover.row}, Col: {hover.col}
              </text>
              <text x={16} y={40} fontSize="10" fill="#0F172A">
                Value: {hover.value !== null ? formatScaleValue(hover.value) : 'N/A'}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function ViewerPanel({
  selectedPath,
  viewMode,
  meta,
  loading,
  error,
  preview,
  previewLoading,
  previewError,
  activeTab,
  displayDims,
  stagedDisplayDims,
  stagedFixedIndices,
  onDisplayDimsChange,
  onFixedIndexChange,
  onApplyDimensions,
  onResetDimensions,
  notation,
  lineGrid,
  lineAspect,
  heatmapGrid,
  heatmapColormap,
  matrixEnabled,
  matrixLoading,
  matrixError,
  matrixVersion,
  matrixShape,
  matrixBlockSize,
  getMatrixBlock,
  onRequestMatrixBlock,
  onEnableMatrix,
  heatmapLoading,
  heatmapError,
  heatmapData,
  onEnableHeatmap,
  onHeatmapZoom,
  lineLoading,
  lineError,
  lineData,
  onEnableLine,
  onLineViewChange
}) {
  const isInspect = viewMode === 'inspect';
  const isDisplay = viewMode === 'display';
  const isDataset = meta?.kind === 'dataset';
  const isGroup = meta?.kind === 'group';
  const hasSelection = selectedPath && selectedPath !== '/';
  const canShowHeatmap = preview?.ndim >= 2;
  const lineSeries = getLineSeries(preview, lineData);
  const lineChartResetKey = useMemo(
    () => buildLineChartResetKey(selectedPath, lineSeries, lineData),
    [selectedPath, lineSeries, lineData]
  );
  const isLineTab = activeTab === 'line';

  const appliedDisplayDims = Array.isArray(displayDims) && displayDims.length === 2
    ? displayDims
    : (Array.isArray(preview?.display_dims) ? preview.display_dims : [0, 1]);
  const resolvedDisplayDims = Array.isArray(stagedDisplayDims) && stagedDisplayDims.length === 2
    ? stagedDisplayDims
    : appliedDisplayDims;
  const yDim = resolvedDisplayDims[0];
  const xDim = resolvedDisplayDims[1];
  const dimOptions = preview?.shape ? preview.shape.map((_, idx) => idx) : [];

  const displayDimsLabel = appliedDisplayDims.length === 2
    ? `D${appliedDisplayDims[0]} x D${appliedDisplayDims[1]}`
    : 'Auto';
  const hasPendingDims = appliedDisplayDims.length === 2
    && resolvedDisplayDims.length === 2
    && (appliedDisplayDims[0] !== resolvedDisplayDims[0]
      || appliedDisplayDims[1] !== resolvedDisplayDims[1]);

  const handleDisplayDimChange = (index, value) => {
    if (!preview?.shape || !onDisplayDimsChange) return;
    const nextDims = [...resolvedDisplayDims];
    nextDims[index] = value;
    if (nextDims[0] === nextDims[1]) {
      nextDims[index === 0 ? 1 : 0] = value === 0 ? 1 : 0;
    }
    onDisplayDimsChange(nextDims, preview.shape);
  };

  const handleAxisChange = (axis, value) => {
    if (!preview?.shape || !onDisplayDimsChange) return;
    const nextDims = [...resolvedDisplayDims];
    if (axis === 'x') {
      nextDims[1] = value;
    } else {
      nextDims[0] = value;
    }
    if (nextDims[0] === nextDims[1]) {
      nextDims[axis === 'x' ? 0 : 1] = value === 0 ? 1 : 0;
    }
    onDisplayDimsChange(nextDims, preview.shape);
  };

  return (
    <div className={`viewer-panel ${isInspect ? 'is-inspect' : ''} ${isDisplay ? 'is-display' : ''}`}>
      <div className="panel-canvas">
        {isDisplay && !hasSelection && (
          <div className="panel-state">
            <div className="state-text">
              Select a dataset from the tree to view a preview.
            </div>
          </div>
        )}

        {isDisplay && hasSelection && previewLoading && (
          <div className="panel-state">
            <div className="loading-spinner"></div>
            <div className="state-text">Loading preview...</div>
          </div>
        )}

        {isDisplay && hasSelection && previewError && !previewLoading && (
          <div className="panel-state error">
            <div className="state-text error-text">{previewError}</div>
          </div>
        )}

        {isDisplay && hasSelection && !previewLoading && !previewError && preview && (
          <div className="preview-shell">
            <div className={`preview-layout ${isLineTab ? 'is-line' : ''}`}>
              {(preview.ndim >= 2) && (
                <aside className="preview-sidebar">
                  <div className="dimension-summary">
                    <span className="dim-label">Display dims</span>
                    <span className="dim-value">{displayDimsLabel}</span>
                    {hasPendingDims && preview.ndim > 2 && (
                      <span className="dim-pending">
                        Pending: D{resolvedDisplayDims[0]} x D{resolvedDisplayDims[1]} (click Set)
                      </span>
                    )}
                  </div>

                  {preview.ndim === 2 && (
                    <div className="axis-toggle">
                      <div className="axis-row">
                        <span className="axis-label">x</span>
                        <div className="axis-options">
                          {dimOptions.map((dim) => (
                            <button
                              key={`x-${dim}`}
                              type="button"
                              className={`axis-btn ${xDim === dim ? 'active' : ''}`}
                              onClick={() => handleAxisChange('x', dim)}
                            >
                              D{dim}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!isLineTab && (
                        <div className="axis-row">
                          <span className="axis-label">y</span>
                          <div className="axis-options">
                            {dimOptions.map((dim) => (
                              <button
                                key={`y-${dim}`}
                                type="button"
                                className={`axis-btn ${yDim === dim ? 'active' : ''}`}
                                onClick={() => handleAxisChange('y', dim)}
                              >
                                D{dim}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {preview.ndim > 2 && (
                    <div className="dimension-controls">
                      <div className="dim-group">
                        <label>Display dim A</label>
                        <select
                          value={resolvedDisplayDims[0] ?? 0}
                          onChange={(event) => handleDisplayDimChange(0, Number(event.target.value))}
                        >
                          {preview.shape.map((_, idx) => (
                            <option key={idx} value={idx}>
                              D{idx} (size {preview.shape[idx]})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="dim-group">
                        <label>Display dim B</label>
                        <select
                          value={resolvedDisplayDims[1] ?? 1}
                          onChange={(event) => handleDisplayDimChange(1, Number(event.target.value))}
                        >
                          {preview.shape.map((_, idx) => (
                            <option key={idx} value={idx}>
                              D{idx} (size {preview.shape[idx]})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="dim-sliders">
                        {preview.shape.map((size, dim) => {
                          if (resolvedDisplayDims.includes(dim)) return null;
                          const max = Math.max(0, size - 1);
                          const current = stagedFixedIndices?.[dim] ?? Math.floor(size / 2);
                          return (
                            <div className="dim-slider" key={dim}>
                              <label>Dim {dim} index</label>
                              <div className="slider-row">
                                <input
                                  type="range"
                                  min={0}
                                  max={max}
                                  value={current}
                                  onChange={(event) => onFixedIndexChange?.(dim, Number(event.target.value), size)}
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={max}
                                  value={current}
                                  onChange={(event) => onFixedIndexChange?.(dim, Number(event.target.value), size)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Set/Reset buttons */}
                      <div className="dim-controls-buttons">
                        <button
                          type="button"
                          className="dim-set-btn"
                          onClick={onApplyDimensions}
                          disabled={!preview}
                        >
                          Set
                        </button>
                        <button
                          type="button"
                          className="dim-reset-btn"
                          onClick={onResetDimensions}
                          disabled={!preview}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              )}

              <div className="preview-content">
                {activeTab === 'table' && (
                  <div className="data-section">
                    <div className="data-actions">
                      <button
                        type="button"
                        className="data-btn"
                        onClick={onEnableMatrix}
                        disabled={!matrixShape || matrixLoading}
                      >
                        Load full view
                      </button>
                      {matrixLoading && <span className="data-status">Loading blocks...</span>}
                      {matrixError && <span className="data-status error">{matrixError}</span>}
                    </div>
                    {matrixEnabled && matrixShape ? (
                      <VirtualMatrixTable
                        rows={matrixShape.rows}
                        cols={matrixShape.cols}
                        blockRows={matrixBlockSize?.rows || 200}
                        blockCols={matrixBlockSize?.cols || 50}
                        getBlock={getMatrixBlock}
                        onRequestBlock={onRequestMatrixBlock}
                        notation={notation}
                        cacheVersion={matrixVersion}
                      />
                    ) : renderTable(preview, notation)}
                  </div>
                )}
                {activeTab === 'line' && (
                  <div className="data-section">
                    <div className="data-actions">
                      <button
                        type="button"
                        className="data-btn"
                        onClick={onEnableLine}
                        disabled={lineLoading}
                      >
                        Load full line
                      </button>
                      {lineLoading && <span className="data-status">Loading line...</span>}
                      {lineError && <span className="data-status error">{lineError}</span>}
                    </div>
                    <LineChart
                      key={lineChartResetKey}
                      series={lineSeries}
                      notation={notation}
                      gridEnabled={lineGrid}
                      aspectMode={lineAspect}
                      onViewChange={onLineViewChange}
                    />
                  </div>
                )}
                {activeTab === 'heatmap' && canShowHeatmap && (
                  <div className="data-section">
                    <div className="data-actions">
                      <button
                        type="button"
                        className="data-btn"
                        onClick={onEnableHeatmap}
                        disabled={heatmapLoading}
                      >
                        Load high-res
                      </button>
                      {heatmapLoading && <span className="data-status">Loading heatmap...</span>}
                      {heatmapError && <span className="data-status error">{heatmapError}</span>}
                      {heatmapData?.max_size_clamped && (
                        <span className="data-status info">
                          Clamped to {heatmapData.effective_max_size} for response limits.
                        </span>
                      )}
                    </div>
                    {renderHeatmap(preview, heatmapData, heatmapColormap, heatmapGrid, onHeatmapZoom)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!isInspect && !isDisplay && (
          <div className="panel-state">
            <div className="state-text">
              Switch to <strong>Inspect</strong> to view metadata for the selected item.
            </div>
          </div>
        )}

        {isInspect && loading && (
          <div className="panel-state">
            <div className="loading-spinner"></div>
            <div className="state-text">Loading metadata...</div>
          </div>
        )}

        {isInspect && error && !loading && (
          <div className="panel-state error">
            <div className="state-text error-text">{error}</div>
          </div>
        )}

        {isInspect && !loading && !error && !meta && (
          <div className="panel-state">
            <div className="state-text">
              Select an item from the tree to view its metadata.
            </div>
          </div>
        )}

        {isInspect && !loading && !error && meta && (
          <div className="metadata-simple">
            <div className="info-row">
              <span className="info-label">Name</span>
              <span className="info-value">{meta.name || '(root)'}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Path</span>
              <span className="info-value mono">{meta.path}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Kind</span>
              <span className="info-value">{meta.kind}</span>
            </div>

            {isGroup && meta.num_children !== undefined && (
              <div className="info-row">
                <span className="info-label">Children</span>
                <span className="info-value">{meta.num_children}</span>
              </div>
            )}

            {isDataset && meta.type && typeof meta.type === 'object' && (
              <>
                <div className="info-row">
                  <span className="info-label">Type</span>
                  <span className="info-value">{formatTypeDescription(meta.type)}</span>
                </div>

                <div className="info-row">
                  <span className="info-label">Class</span>
                  <span className="info-value">{meta.type.class || '--'}</span>
                </div>

                {meta.type.signed !== undefined && (
                  <div className="info-row">
                    <span className="info-label">Signed</span>
                    <span className="info-value">{meta.type.signed ? 'Yes' : 'No'}</span>
                  </div>
                )}

                {meta.type.endianness && (
                  <div className="info-row">
                    <span className="info-label">Endianness</span>
                    <span className="info-value">{meta.type.endianness}</span>
                  </div>
                )}

                {meta.type.size && (
                  <div className="info-row">
                    <span className="info-label">Size</span>
                    <span className="info-value">{meta.type.size} bits</span>
                  </div>
                )}
              </>
            )}

            {isDataset && (
              <>
                {meta.shape && (
                  <div className="info-row">
                    <span className="info-label">Shape</span>
                    <span className="info-value mono">[{formatValue(meta.shape)}]</span>
                  </div>
                )}

                {meta.ndim !== undefined && (
                  <div className="info-row">
                    <span className="info-label">Dimensions</span>
                    <span className="info-value">{meta.ndim}D</span>
                  </div>
                )}

                {meta.size !== undefined && (
                  <div className="info-row">
                    <span className="info-label">Total Elements</span>
                    <span className="info-value">{meta.size.toLocaleString()}</span>
                  </div>
                )}

                {meta.dtype && (
                  <div className="info-row">
                    <span className="info-label">DType</span>
                    <span className="info-value mono">{meta.dtype}</span>
                  </div>
                )}

                {meta.chunks && (
                  <div className="info-row">
                    <span className="info-label">Chunks</span>
                    <span className="info-value mono">[{formatValue(meta.chunks)}]</span>
                  </div>
                )}
              </>
            )}

            {isDataset && meta.compression && (
              <div className="info-row">
                <span className="info-label">Compression</span>
                <span className="info-value">
                  {meta.compression}
                  {meta.compression_opts && ` (level ${meta.compression_opts})`}
                </span>
              </div>
            )}

            {isDataset && meta.filters && meta.filters.length > 0 && (
              <div className="info-row">
                <span className="info-label">Filters</span>
                <span className="info-value">
                  {meta.filters.map((filter, idx) => (
                    <span key={idx}>
                      {filter.name}{filter.level && ` (${filter.level})`}
                      {idx < meta.filters.length - 1 && ', '}
                    </span>
                  ))}
                </span>
              </div>
            )}

            {isDataset && meta.rawType && (
              <>
                <div className="info-row">
                  <span className="info-label">Type Number</span>
                  <span className="info-value mono">{meta.rawType.type}</span>
                </div>

                <div className="info-row">
                  <span className="info-label">Size (bytes)</span>
                  <span className="info-value">{meta.rawType.size}</span>
                </div>

                <div className="info-row">
                  <span className="info-label">Little Endian</span>
                  <span className="info-value">{meta.rawType.littleEndian ? 'Yes' : 'No'}</span>
                </div>

                <div className="info-row">
                  <span className="info-label">Variable Length</span>
                  <span className="info-value">{meta.rawType.vlen ? 'Yes' : 'No'}</span>
                </div>
              </>
            )}

            {meta.attributes && meta.attributes.length > 0 && (
              <>
                <div className="info-section-title">Attributes ({meta.attributes.length})</div>
                {meta.attributes.map((attr, idx) => (
                  <div key={idx} className="info-row indent">
                    <span className="info-label">{attr.name}</span>
                    <span className="info-value mono">{formatValue(attr.value)}</span>
                  </div>
                ))}
              </>
            )}

            <div className="info-section-title">Raw JSON</div>
            <pre className="json-view">{JSON.stringify(meta, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

HeatmapChart.propTypes = {
  data: PropTypes.array.isRequired,
  stats: PropTypes.object,
  colormap: PropTypes.string,
  showGrid: PropTypes.bool,
  onZoom: PropTypes.func
};

ViewerPanel.propTypes = {
  selectedPath: PropTypes.string,
  viewMode: PropTypes.string.isRequired,
  meta: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  preview: PropTypes.object,
  previewLoading: PropTypes.bool,
  previewError: PropTypes.string,
  activeTab: PropTypes.string,
  displayDims: PropTypes.array,
  stagedDisplayDims: PropTypes.array,
  stagedFixedIndices: PropTypes.object,
  onDisplayDimsChange: PropTypes.func,
  onFixedIndexChange: PropTypes.func,
  onApplyDimensions: PropTypes.func,
  onResetDimensions: PropTypes.func,
  notation: PropTypes.string,
  lineGrid: PropTypes.bool,
  lineAspect: PropTypes.string,
  heatmapGrid: PropTypes.bool,
  heatmapColormap: PropTypes.string,
  matrixEnabled: PropTypes.bool,
  matrixLoading: PropTypes.bool,
  matrixError: PropTypes.string,
  matrixVersion: PropTypes.number,
  matrixShape: PropTypes.object,
  matrixBlockSize: PropTypes.object,
  getMatrixBlock: PropTypes.func,
  onRequestMatrixBlock: PropTypes.func,
  onEnableMatrix: PropTypes.func,
  heatmapLoading: PropTypes.bool,
  heatmapError: PropTypes.string,
  heatmapData: PropTypes.object,
  onEnableHeatmap: PropTypes.func,
  onHeatmapZoom: PropTypes.func,
  lineLoading: PropTypes.bool,
  lineError: PropTypes.string,
  lineData: PropTypes.object,
  onEnableLine: PropTypes.func,
  onLineViewChange: PropTypes.func
};

export default ViewerPanel;
