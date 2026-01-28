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

const renderHeatmap = (preview) => {
  if (preview?.plot?.type !== 'heatmap') {
    return (
      <div className="panel-state">
        <div className="state-text">Heatmap preview not available.</div>
      </div>
    );
  }

  return (
    <div className="preview-heatmap">
      <HeatmapCanvas data={preview.plot.data || []} />
    </div>
  );
};

function HeatmapCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !Array.isArray(data) || data.length === 0) return;
    const rows = data.length;
    const cols = data[0]?.length || 0;
    if (cols === 0) return;

    const flat = data.flat().map((value) => normalizeNumber(value));
    const valid = flat.filter((value) => value !== null);
    if (valid.length === 0) return;

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const span = max - min || 1;

    const canvas = canvasRef.current;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(cols, rows);

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const idx = (r * cols + c) * 4;
        const value = normalizeNumber(data[r][c]);
        const t = value === null ? 0 : (value - min) / span;
        const baseR = 242;
        const baseG = 246;
        const baseB = 255;
        const targetR = 37;
        const targetG = 99;
        const targetB = 235;
        image.data[idx] = Math.round(baseR + (targetR - baseR) * t);
        image.data[idx + 1] = Math.round(baseG + (targetG - baseG) * t);
        image.data[idx + 2] = Math.round(baseB + (targetB - baseB) * t);
        image.data[idx + 3] = value === null ? 0 : 255;
      }
    }

    ctx.putImageData(image, 0, 0);
  }, [data]);

  return <canvas ref={canvasRef} className="heatmap-canvas" />;
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
  onDisplayDimsChange,
  onFixedIndexChange,
  notation,
  lineGrid,
  lineAspect
}) {
  const isInspect = viewMode === 'inspect';
  const isDisplay = viewMode === 'display';
  const isDataset = meta?.kind === 'dataset';
  const isGroup = meta?.kind === 'group';
  const hasSelection = selectedPath && selectedPath !== '/';
  const canShowHeatmap = preview?.ndim >= 2;
  const lineSeries = getLineSeries(preview);
  const isLineTab = activeTab === 'line';

  const resolvedDisplayDims = Array.isArray(displayDims) && displayDims.length === 2
    ? displayDims
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
                          const current = fixedIndices?.[dim] ?? Math.floor(size / 2);
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
                {activeTab === 'heatmap' && canShowHeatmap && renderHeatmap(preview)}
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

HeatmapCanvas.propTypes = {
  data: PropTypes.array
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
  onDisplayDimsChange: PropTypes.func,
  onFixedIndexChange: PropTypes.func,
  notation: PropTypes.string,
  lineGrid: PropTypes.bool,
  lineAspect: PropTypes.string
};

export default ViewerPanel;
