import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileMeta, getFilePreview, getFileData } from '../api';
import SidebarTree from '../components/viewer/SidebarTree';
import TopBar from '../components/viewer/TopBar';
import PreviewToolbar from '../components/viewer/PreviewToolbar';
import ViewerPanel from '../components/viewer/ViewerPanel';
import './ViewerPage.css';

const DEBUG = import.meta.env.DEV;
const MATRIX_BLOCK_ROWS = 200;
const MATRIX_BLOCK_COLS = 50;
const HEATMAP_MAX_SIZE = 1024;

const logPreview = (...args) => {
  if (!DEBUG) return;
  console.info('[preview]', ...args);
};

const normalizeFixedIndices = (indices) => {
  if (!indices) return {};
  return Object.entries(indices).reduce((acc, [key, value]) => {
    const dim = Number(key);
    const idx = Number(value);
    if (Number.isFinite(dim) && Number.isFinite(idx)) {
      acc[dim] = idx;
    }
    return acc;
  }, {});
};

const buildFixedIndicesParam = (indices) => {
  const entries = Object.entries(indices || {})
    .filter(([key, value]) => Number.isFinite(Number(key)) && Number.isFinite(Number(value)))
    .sort(([a], [b]) => Number(a) - Number(b));
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key}=${value}`).join(',');
};

function ViewerPage({ fileKey, onBack }) {
  const [selectedPath, setSelectedPath] = useState('/');
  const [viewMode, setViewMode] = useState('display');
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [displayTab, setDisplayTab] = useState('table');
  const [displayDims, setDisplayDims] = useState(null);
  const [fixedIndices, setFixedIndices] = useState({});
  // Staging state for dimension controls
  const [stagedDisplayDims, setStagedDisplayDims] = useState(null);
  const [stagedFixedIndices, setStagedFixedIndices] = useState({});
  const [notation, setNotation] = useState('auto');
  const [lineGrid, setLineGrid] = useState(true);
  const [lineAspect, setLineAspect] = useState('line');
  const [heatmapGrid, setHeatmapGrid] = useState(true);
  const [heatmapColormap, setHeatmapColormap] = useState('viridis');
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [matrixVersion, setMatrixVersion] = useState(0);
  const matrixCacheRef = useRef(new Map());
  const matrixPendingRef = useRef(new Set());

  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const heatmapKeyRef = useRef('');

  const [lineEnabled, setLineEnabled] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [lineError, setLineError] = useState(null);
  const [lineData, setLineData] = useState(null);
  const lineKeyRef = useRef('');
  const lineTimerRef = useRef(null);

  const showHeatmap = useMemo(() => preview?.ndim >= 2, [preview]);
  const displayDimsKey = useMemo(() => {
    if (!Array.isArray(displayDims) || displayDims.length !== 2) return '';
    return displayDims.join(',');
  }, [displayDims]);
  const fixedIndicesKey = useMemo(() => buildFixedIndicesParam(fixedIndices) || '', [fixedIndices]);
  const selectionKey = useMemo(() => {
    if (!fileKey || !selectedPath) return '';
    return [fileKey, selectedPath, displayDimsKey, fixedIndicesKey].join('|');
  }, [fileKey, selectedPath, displayDimsKey, fixedIndicesKey]);
  const matrixShape = useMemo(() => {
    if (!preview?.shape || !Array.isArray(displayDims) || displayDims.length !== 2) return null;
    const rows = preview.shape[displayDims[0]];
    const cols = preview.shape[displayDims[1]];
    if (!Number.isFinite(rows) || !Number.isFinite(cols)) return null;
    return { rows, cols };
  }, [preview, displayDims]);

  const resetDataState = useCallback(() => {
    matrixCacheRef.current = new Map();
    matrixPendingRef.current = new Set();
    setMatrixEnabled(false);
    setMatrixLoading(false);
    setMatrixError(null);
    setMatrixVersion(0);

    setHeatmapEnabled(false);
    setHeatmapLoading(false);
    setHeatmapError(null);
    setHeatmapData(null);
    heatmapKeyRef.current = '';

    setLineEnabled(false);
    setLineLoading(false);
    setLineError(null);
    setLineData(null);
    lineKeyRef.current = '';
    if (lineTimerRef.current) {
      clearTimeout(lineTimerRef.current);
      lineTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setSelectedPath('/');
  }, [fileKey]);

  useEffect(() => {
    setDisplayTab('table');
    setDisplayDims(null);
    setFixedIndices({});
    setStagedDisplayDims(null);
    setStagedFixedIndices({});
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setHeatmapGrid(true);
    setHeatmapColormap('viridis');
    resetDataState();
  }, [fileKey, selectedPath]);

  useEffect(() => {
    if (preview && displayTab === 'heatmap' && preview.ndim < 2) {
      setDisplayTab('table');
    }
  }, [preview, displayTab]);

  useEffect(() => {
    if (!selectionKey) return;
    resetDataState();
  }, [selectionKey, resetDataState]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!fileKey || !selectedPath || viewMode !== 'inspect') {
        setMeta(null);
        setMetaError(null);
        setMetaLoading(false);
        return;
      }
      if (selectedPath === '/') {
        setMeta(null);
        setMetaError(null);
        setMetaLoading(false);
        return;
      }
      try {
        setMetaLoading(true);
        setMetaError(null);
        const data = await getFileMeta(fileKey, selectedPath);
        setMeta(data.metadata || null);
      } catch (err) {
        setMetaError(err.message || 'Failed to load metadata');
        setMeta(null);
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();
  }, [fileKey, selectedPath, viewMode]);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!fileKey || !selectedPath || viewMode !== 'display') {
        setPreview(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }
      if (selectedPath === '/') {
        setPreview(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      const params = {
        mode: 'auto',
        max_size: 512
      };

      if (displayDimsKey) {
        params.display_dims = displayDimsKey;
      }

      if (fixedIndicesKey) {
        params.fixed_indices = fixedIndicesKey;
      }

      try {
        logPreview('request', { fileKey, selectedPath, params });
        setPreviewLoading(true);
        setPreviewError(null);
        const data = await getFilePreview(fileKey, selectedPath, params);
        setPreview(data || null);
        logPreview('response', {
          cached: data?.cached,
          ndim: data?.ndim,
          shape: data?.shape,
          display_dims: data?.display_dims,
          fixed_indices: data?.fixed_indices
        });

        setDisplayDims((current) => {
          const newDims = Array.isArray(current) && current.length === 2
            ? current
            : Array.isArray(data?.display_dims) ? data.display_dims : [0, 1];
          setStagedDisplayDims(newDims); // Sync staging state
          return newDims;
        });

        setFixedIndices((current) => {
          let newIndices = current;
          if (Object.keys(current).length === 0 && data?.fixed_indices) {
            const next = normalizeFixedIndices(data.fixed_indices);
            newIndices = Object.keys(next).length > 0 ? next : current;
          }
          setStagedFixedIndices(newIndices); // Sync staging state
          return newIndices;
        });
      } catch (err) {
        setPreviewError(err.message || 'Failed to load preview');
        setPreview(null);
        logPreview('error', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();
  }, [fileKey, selectedPath, viewMode, displayDimsKey, fixedIndicesKey]);

  const buildMatrixCacheKey = useCallback((rowOffset, colOffset, rowLimit, colLimit) => {
    if (!selectionKey) return '';
    return `${selectionKey}|r${rowOffset}|c${colOffset}|rl${rowLimit}|cl${colLimit}|rs1|cs1`;
  }, [selectionKey]);

  const getMatrixBlock = useCallback((rowOffset, colOffset, rowLimit, colLimit) => {
    const key = buildMatrixCacheKey(rowOffset, colOffset, rowLimit, colLimit);
    if (!key) return null;
    return matrixCacheRef.current.get(key) || null;
  }, [buildMatrixCacheKey]);

  const requestMatrixBlock = useCallback(async (rowOffset, colOffset, rowLimit, colLimit) => {
    if (!fileKey || !selectedPath || !matrixShape) return;
    const safeRowLimit = Math.min(rowLimit, Math.max(0, matrixShape.rows - rowOffset));
    const safeColLimit = Math.min(colLimit, Math.max(0, matrixShape.cols - colOffset));
    if (safeRowLimit <= 0 || safeColLimit <= 0) return;

    const key = buildMatrixCacheKey(rowOffset, colOffset, safeRowLimit, safeColLimit);
    if (!key || matrixCacheRef.current.has(key) || matrixPendingRef.current.has(key)) return;

    matrixPendingRef.current.add(key);
    setMatrixLoading(true);
    setMatrixError(null);

    try {
      const params = {
        mode: 'matrix',
        row_offset: rowOffset,
        row_limit: safeRowLimit,
        col_offset: colOffset,
        col_limit: safeColLimit
      };
      if (displayDimsKey) params.display_dims = displayDimsKey;
      if (fixedIndicesKey) params.fixed_indices = fixedIndicesKey;

      const data = await getFileData(fileKey, selectedPath, params);
      matrixCacheRef.current.set(key, data);
      setMatrixVersion((value) => value + 1);
    } catch (err) {
      setMatrixError(err.message || 'Failed to load matrix data');
    } finally {
      matrixPendingRef.current.delete(key);
      setMatrixLoading(matrixPendingRef.current.size > 0);
    }
  }, [fileKey, selectedPath, matrixShape, buildMatrixCacheKey, displayDimsKey, fixedIndicesKey]);

  const handleEnableMatrix = useCallback(() => {
    if (!matrixShape) return;
    setMatrixEnabled(true);
    const initialRows = Math.min(MATRIX_BLOCK_ROWS, matrixShape.rows);
    const initialCols = Math.min(MATRIX_BLOCK_COLS, matrixShape.cols);
    requestMatrixBlock(0, 0, initialRows, initialCols);
  }, [matrixShape, requestMatrixBlock]);

  const requestHeatmap = useCallback(async (maxSize) => {
    if (!fileKey || !selectedPath) return;
    const requestKey = `${selectionKey}|heatmap|max=${maxSize}`;
    if (heatmapKeyRef.current === requestKey && heatmapData) return;

    setHeatmapEnabled(true);
    setHeatmapLoading(true);
    setHeatmapError(null);
    heatmapKeyRef.current = requestKey;

    try {
      const params = {
        mode: 'heatmap',
        max_size: maxSize
      };
      if (displayDimsKey) params.display_dims = displayDimsKey;
      if (fixedIndicesKey) params.fixed_indices = fixedIndicesKey;

      const data = await getFileData(fileKey, selectedPath, params);
      setHeatmapData(data);
    } catch (err) {
      setHeatmapError(err.message || 'Failed to load heatmap data');
    } finally {
      setHeatmapLoading(false);
    }
  }, [fileKey, selectedPath, selectionKey, displayDimsKey, fixedIndicesKey, heatmapData]);

  const handleHeatmapZoom = useCallback((zoomLevel) => {
    if (zoomLevel <= 1) return;
    requestHeatmap(HEATMAP_MAX_SIZE);
  }, [requestHeatmap]);

  const resolveLineParams = useCallback((range) => {
    if (!preview?.shape) return null;
    const shape = preview.shape;
    const ndim = preview.ndim ?? shape.length;
    let lineDim = null;
    let lineIndex = null;
    let lineLength = 0;

    if (ndim === 1) {
      lineLength = shape[0];
    } else if (Array.isArray(displayDims) && displayDims.length === 2) {
      const rows = shape[displayDims[0]];
      const cols = shape[displayDims[1]];
      lineDim = 'row';
      lineIndex = Math.floor(rows / 2);
      lineLength = cols;
    } else {
      lineLength = shape[0];
    }

    if (!Number.isFinite(lineLength) || lineLength <= 0) return null;

    let lineOffset = 0;
    let lineLimit = lineLength;
    if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
      const start = Math.max(0, Math.floor(Math.min(range.start, range.end)));
      const end = Math.min(lineLength - 1, Math.ceil(Math.max(range.start, range.end)));
      lineOffset = Math.min(start, lineLength - 1);
      lineLimit = Math.max(0, end - lineOffset + 1);
    }

    return {
      line_dim: lineDim,
      line_index: lineIndex,
      line_offset: lineOffset,
      line_limit: lineLimit,
      line_length: lineLength
    };
  }, [preview, displayDims]);

  const requestLine = useCallback(async (range) => {
    if (!fileKey || !selectedPath) return;
    const params = resolveLineParams(range);
    if (!params) return;

    const requestKey = `${selectionKey}|line|${params.line_dim}|${params.line_index}|${params.line_offset}|${params.line_limit}`;
    if (lineKeyRef.current === requestKey && lineData) return;

    setLineEnabled(true);
    setLineLoading(true);
    setLineError(null);
    lineKeyRef.current = requestKey;

    try {
      const query = {
        mode: 'line',
        line_offset: params.line_offset,
        line_limit: params.line_limit
      };
      if (params.line_dim) query.line_dim = params.line_dim;
      if (Number.isFinite(params.line_index)) query.line_index = params.line_index;
      if (displayDimsKey) query.display_dims = displayDimsKey;
      if (fixedIndicesKey) query.fixed_indices = fixedIndicesKey;

      const data = await getFileData(fileKey, selectedPath, query);
      setLineData(data);
    } catch (err) {
      setLineError(err.message || 'Failed to load line data');
    } finally {
      setLineLoading(false);
    }
  }, [fileKey, selectedPath, selectionKey, resolveLineParams, displayDimsKey, fixedIndicesKey, lineData]);

  const handleLineViewChange = useCallback((range) => {
    if (!range) return;
    if (lineTimerRef.current) {
      clearTimeout(lineTimerRef.current);
    }
    lineTimerRef.current = setTimeout(() => {
      requestLine(range);
    }, 250);
  }, [requestLine]);

  // Dimension control handlers for staging
  const handleStagedDisplayDimsChange = (nextDims, shape) => {
    if (!Array.isArray(nextDims) || nextDims.length !== 2) return;
    logPreview('staged_display_dims_change', nextDims);
    setStagedDisplayDims(nextDims);
    
    // Clear staged fixed indices for dimensions that are now display dimensions
    setStagedFixedIndices((current) => {
      const next = { ...current };
      nextDims.forEach((dim) => {
        delete next[dim];
      });
      // Add default values for non-display dimensions
      shape?.forEach((size, dim) => {
        if (nextDims.includes(dim)) return;
        const max = Math.max(0, size - 1);
        const fallback = Math.floor(size / 2);
        if (!Number.isFinite(next[dim])) {
          next[dim] = fallback;
        } else {
          next[dim] = Math.max(0, Math.min(max, next[dim]));
        }
      });
      return next;
    });
  };

  const handleStagedFixedIndexChange = (dim, value, size) => {
    const max = Math.max(0, size - 1);
    const clamped = Math.max(0, Math.min(max, value));
    setStagedFixedIndices((current) => ({
      ...current,
      [dim]: clamped
    }));
  };

  const handleApplyDimensions = () => {
    // Apply staged changes to actual state
    setDisplayDims(stagedDisplayDims);
    setFixedIndices(stagedFixedIndices);
  };

  const handleResetDimensions = () => {
    // Reset to defaults based on current preview data
    if (preview?.shape) {
      const defaultDisplayDims = preview.display_dims || [0, 1];
      const defaultFixedIndices = {};
      
      // Set default fixed indices for non-display dimensions
      preview.shape.forEach((size, dim) => {
        if (!defaultDisplayDims.includes(dim)) {
          defaultFixedIndices[dim] = Math.floor(size / 2);
        }
      });
      
      setStagedDisplayDims(defaultDisplayDims);
      setStagedFixedIndices(defaultFixedIndices);
    }
  };

  const handleDisplayDimsChange = (nextDims, shape) => {
    if (!Array.isArray(nextDims) || nextDims.length !== 2) return;
    logPreview('display_dims_change', nextDims);
    setDisplayDims(nextDims);
    setFixedIndices((current) => {
      const next = { ...current };
      nextDims.forEach((dim) => {
        delete next[dim];
      });
      shape.forEach((size, dim) => {
        if (nextDims.includes(dim)) return;
        const max = Math.max(0, size - 1);
        const fallback = Math.floor(size / 2);
        const value = Number.isFinite(next[dim]) ? next[dim] : fallback;
        next[dim] = Math.max(0, Math.min(value, max));
      });
      return next;
    });
  };

  const handleFixedIndexChange = (dim, value, size) => {
    if (!Number.isFinite(dim) || !Number.isFinite(value)) return;
    if (Array.isArray(displayDims) && displayDims.includes(dim)) return;
    const max = Math.max(0, (size || 1) - 1);
    const clamped = Math.max(0, Math.min(value, max));
    logPreview('fixed_index_change', { dim, value: clamped });
    setFixedIndices((current) => ({
      ...current,
      [dim]: clamped
    }));
  };

  return (
    <div className="viewer-page">
      <SidebarTree
        fileKey={fileKey}
        selectedPath={selectedPath}
        onSelect={setSelectedPath}
      />
      <section className="viewer-main">
        <TopBar
          fileKey={fileKey}
          selectedPath={selectedPath}
          viewMode={viewMode}
          onModeChange={setViewMode}
          onBack={onBack}
        />
        {viewMode === 'display' && (
          <PreviewToolbar
            activeTab={displayTab}
            onTabChange={setDisplayTab}
            showHeatmap={showHeatmap}
            onExport={() => {}}
            disabled={!preview || previewLoading}
            notation={notation}
            onNotationChange={setNotation}
            lineGrid={lineGrid}
            onLineGridChange={setLineGrid}
            lineAspect={lineAspect}
            onLineAspectChange={setLineAspect}
            heatmapGrid={heatmapGrid}
            onHeatmapGridChange={setHeatmapGrid}
            heatmapColormap={heatmapColormap}
            onHeatmapColormapChange={setHeatmapColormap}
          />
        )}
        <ViewerPanel
          selectedPath={selectedPath}
          viewMode={viewMode}
          meta={meta}
          loading={metaLoading}
          error={metaError}
          preview={preview}
          previewLoading={previewLoading}
          previewError={previewError}
          activeTab={displayTab}
          displayDims={displayDims}
          fixedIndices={fixedIndices}
          stagedDisplayDims={stagedDisplayDims}
          stagedFixedIndices={stagedFixedIndices}
          onDisplayDimsChange={handleStagedDisplayDimsChange}
          onFixedIndexChange={handleStagedFixedIndexChange}
          onApplyDimensions={handleApplyDimensions}
          onResetDimensions={handleResetDimensions}
          notation={notation}
          lineGrid={lineGrid}
          lineAspect={lineAspect}
          heatmapGrid={heatmapGrid}
          heatmapColormap={heatmapColormap}
          matrixEnabled={matrixEnabled}
          matrixLoading={matrixLoading}
          matrixError={matrixError}
          matrixVersion={matrixVersion}
          matrixShape={matrixShape}
          matrixBlockSize={{ rows: MATRIX_BLOCK_ROWS, cols: MATRIX_BLOCK_COLS }}
          getMatrixBlock={getMatrixBlock}
          onRequestMatrixBlock={requestMatrixBlock}
          onEnableMatrix={handleEnableMatrix}
          heatmapEnabled={heatmapEnabled}
          heatmapLoading={heatmapLoading}
          heatmapError={heatmapError}
          heatmapData={heatmapData}
          onEnableHeatmap={() => requestHeatmap(HEATMAP_MAX_SIZE)}
          onHeatmapZoom={handleHeatmapZoom}
          lineEnabled={lineEnabled}
          lineLoading={lineLoading}
          lineError={lineError}
          lineData={lineData}
          onEnableLine={() => requestLine(null)}
          onLineViewChange={handleLineViewChange}
        />
      </section>
    </div>
  );
}

export default ViewerPage;
