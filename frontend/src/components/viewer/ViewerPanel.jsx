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

const getLineSeries = (preview) => {
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

function LineChart({ series, notation, gridEnabled, aspectMode }) {
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

  const points = useMemo(() => buildLinePoints(series), [series]);
  const hasPoints = points.length > 0;

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setHover(null);
  }, [series]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  if (!hasPoints) {
    return (
      <div className="panel-state">
        <div className="state-text">Line preview not available.</div>
      </div>
    );
  }

  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const width = 760;
  const height = 320;
  const minZoom = 1;
  const maxZoom = 6;
  const padding = 28;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const getPanBounds = (scale) => {
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
  };

  const clampPan = (nextPan, scale) => {
    const bounds = getPanBounds(scale);
    return {
      x: clampValue(nextPan.x, bounds.minX, bounds.maxX),
      y: clampValue(nextPan.y, bounds.minY, bounds.maxY)
    };
  };

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

  const applyZoom = (nextZoom, center) => {
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
  };

  const getViewPoint = (event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return { x, y };
  };

  const handleWheel = useCallback((event) => {
    if (!svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getViewPoint(event);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(zoom * delta, point || { x: width / 2, y: height / 2 });
  }, [zoom]);

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
    const ratioX = (baseX - padding) / chartW;
    if (ratioX < 0 || ratioX > 1) {
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

  const getAxisValueX = (screenX) => {
    const baseX = (screenX - pan.x) / zoom;
    const ratio = (baseX - padding) / chartW;
    return minX + ratio * spanX;
  };

  const getAxisValueY = (screenY) => {
    const baseY = (screenY - pan.y) / zoom;
    const ratio = (baseY - padding) / chartH;
    return maxY - ratio * spanY;
  };

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
        <span>Min: {formatNumber(minY, notation)}</span>
        <span>Max: {formatNumber(maxY, notation)}</span>
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

const renderHeatmap = (preview, heatmapColormap, heatmapGrid) => {
    if (!preview || preview.ndim < 2) {
      return (
        <div className="panel-state">
          <div className="state-text">Heatmap requires 2D or higher dimensional data.</div>
        </div>
      );
    }

    // Get heatmap data based on preview structure
    let heatmapData = null;
    
    if (preview.table?.kind === '2d' && preview.table?.data) {
      // For 2D table data
      heatmapData = preview.table.data;
    } else if (preview.plot?.type === 'heatmap' && preview.plot?.data) {
      // For explicit heatmap plot data
      heatmapData = preview.plot.data;
    } else if (Array.isArray(preview.data)) {
      // For direct data array
      heatmapData = preview.data;
    }
    
    if (!heatmapData || !Array.isArray(heatmapData)) {
      return (
        <div className="panel-state">
          <div className="state-text">No valid 2D data available for heatmap visualization.</div>
        </div>
      );
    }

    return (
      <div className="preview-heatmap">
        <HeatmapChart 
          data={heatmapData} 
          shape={preview.shape}
          colormap={heatmapColormap}
          showGrid={heatmapGrid}
        />
      </div>
    );
  };

function HeatmapChart({ data, shape, colormap = 'viridis', showGrid = true }) {
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
  const [colorRange, setColorRange] = useState({ min: 0, max: 1 });

  // Colormap definitions
  const colormaps = {
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

  // Calculate data statistics and setup
  const stats = useMemo(() => {
    if (!data || !Array.isArray(data)) return { min: 0, max: 1, rows: 0, cols: 0 };
    const rows = data.length;
    const cols = data[0]?.length || 0;
    if (rows === 0 || cols === 0) return { min: 0, max: 1, rows: 0, cols: 0 };
    
    const flat = data.flat().filter(v => Number.isFinite(Number(v)));
    if (flat.length === 0) return { min: 0, max: 1, rows, cols };
    
    const numbers = flat.map(Number);
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return { min, max: max === min ? min + 1 : max, rows, cols };
  }, [data]);

  useEffect(() => {
    setColorRange(stats);
  }, [stats]);

  // Get color from colormap
  const getColor = useCallback((value) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '#888888'; // Gray for invalid values
    }
    
    const normalized = stats.max === stats.min ? 0 : (value - stats.min) / (stats.max - stats.min);
    const clamped = Math.max(0, Math.min(1, normalized));
    const colors = colormaps[colormap] || colormaps.viridis;
    const index = clamped * (colors.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;
    
    if (lower === upper) {
      const [r, g, b] = colors[lower];
      return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    
    const [r1, g1, b1] = colors[lower];
    const [r2, g2, b2] = colors[upper];
    return `rgb(${Math.round((r1 + (r2 - r1) * fraction) * 255)}, ${Math.round((g1 + (g2 - g1) * fraction) * 255)}, ${Math.round((b1 + (b2 - b1) * fraction) * 255)})`;
  }, [colormap, stats]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setHover(null);
  }, [data]);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  if (!data || stats.rows === 0 || stats.cols === 0) {
    return (
      <div className="panel-state">
        <div className="state-text">No valid heatmap data available.</div>
      </div>
    );
  }

  const width = 760;
  const height = 420;
  const minZoom = 1;
  const maxZoom = 6;
  const padding = 50;
  const chartW = width - padding * 2 - 80; // Extra space for color bar
  const chartH = height - padding * 2;
  const cellWidth = chartW / stats.cols;
  const cellHeight = chartH / stats.rows;

  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

  const getPanBounds = (scale) => {
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
  };

  const clampPan = (targetPan, scale) => {
    const bounds = getPanBounds(scale);
    return {
      x: clampValue(targetPan.x, bounds.minX, bounds.maxX),
      y: clampValue(targetPan.y, bounds.minY, bounds.maxY)
    };
  };

  const applyZoom = (targetZoom, anchor = null) => {
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
  };

  const getViewPoint = (event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return { x, y };
  };

  const handleWheel = useCallback((event) => {
    if (!svgRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getViewPoint(event);
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    applyZoom(zoom * delta, point || { x: width / 2, y: height / 2 });
  }, [zoom]);

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

    const col = Math.floor(ratioX * stats.cols);
    const row = Math.floor((1 - ratioY) * stats.rows); // Flip Y for bottom-up indexing
    
    if (col >= 0 && col < stats.cols && row >= 0 && row < stats.rows) {
      const value = data[row] && data[row][col] !== undefined ? Number(data[row][col]) : null;
      setHover({ row, col, value });
    } else {
      setHover(null);
    }
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
              {colormaps[colormap]?.map(([r, g, b], index) => (
                <stop
                  key={index}
                  offset={`${(index / (colormaps[colormap].length - 1)) * 100}%`}
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
                    y={(stats.rows - 1 - rowIdx) * cellHeight} // Flip Y
                    width={cellWidth}
                    height={cellHeight}
                    fill={getColor(value)}
                    stroke={showGrid ? '#ffffff' : 'none'}
                    strokeWidth={showGrid ? 0.5 / zoom : 0} // Scale stroke with zoom
                    strokeOpacity={0.5}
                  />
                ))
              )}
            </g>
          </g>

          {/* Fixed axes (not affected by zoom/pan) */}
          <g fill="#0F172A" fontSize="11" fontFamily="Inter">
            {/* X-axis labels */}
            {Array.from({ length: Math.min(stats.cols, 10) }, (_, i) => {
              const col = Math.round((i / 9) * (stats.cols - 1));
              return (
                <text
                  key={`x-${col}`}
                  x={padding + (col + 0.5) * cellWidth}
                  y={padding + chartH + 16}
                  textAnchor="middle"
                  fill="#0F172A"
                >
                  {col}
                </text>
              );
            })}
            
            {/* Y-axis labels */}
            {Array.from({ length: Math.min(stats.rows, 10) }, (_, i) => {
              const row = Math.round((i / 9) * (stats.rows - 1));
              return (
                <text
                  key={`y-${row}`}
                  x={padding - 10}
                  y={padding + (stats.rows - 1 - row + 0.5) * cellHeight + 4}
                  textAnchor="end"
                  fill="#0F172A"
                >
                  {row}
                </text>
              );
            })}

            {/* Axis titles */}
            <text x={width / 2} y={height - 10} textAnchor="middle" fontSize="13" fontWeight="500">
              Column Index
            </text>
            <text
              x={20}
              y={height / 2}
              textAnchor="middle"
              fontSize="13"
              fontWeight="500"
              transform={`rotate(-90, 20, ${height / 2})`}
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
            <g fill="#0F172A" fontSize="10" fontFamily="Inter">
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
  fixedIndices,
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
  heatmapColormap
}) {
  const isInspect = viewMode === 'inspect';
  const isDisplay = viewMode === 'display';
  const isDataset = meta?.kind === 'dataset';
  const isGroup = meta?.kind === 'group';
  const hasSelection = selectedPath && selectedPath !== '/';
  const canShowHeatmap = preview?.ndim >= 2;
  const lineSeries = getLineSeries(preview);
  const isLineTab = activeTab === 'line';

  const resolvedDisplayDims = Array.isArray(stagedDisplayDims) && stagedDisplayDims.length === 2
    ? stagedDisplayDims
    : (Array.isArray(preview?.display_dims) ? preview.display_dims : [0, 1]);
  const yDim = resolvedDisplayDims[0];
  const xDim = resolvedDisplayDims[1];
  const dimOptions = preview?.shape ? preview.shape.map((_, idx) => idx) : [];

  const displayDimsLabel = resolvedDisplayDims.length === 2
    ? `D${resolvedDisplayDims[0]} x D${resolvedDisplayDims[1]}`
    : 'Auto';

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
                {activeTab === 'table' && renderTable(preview, notation)}
                {activeTab === 'line' && (
                  <LineChart
                    series={lineSeries}
                    notation={notation}
                    gridEnabled={lineGrid}
                    aspectMode={lineAspect}
                  />
                )}
                {activeTab === 'heatmap' && canShowHeatmap && renderHeatmap(preview, heatmapColormap, heatmapGrid)}
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
  shape: PropTypes.array,
  colormap: PropTypes.string,
  showGrid: PropTypes.bool
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
  fixedIndices: PropTypes.object,
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
  heatmapColormap: PropTypes.string
};

export default ViewerPanel;
