import { useEffect, useMemo, useState } from 'react';
import { getFileMeta, getFilePreview } from '../api';
import SidebarTree from '../components/viewer/SidebarTree';
import TopBar from '../components/viewer/TopBar';
import PreviewToolbar from '../components/viewer/PreviewToolbar';
import ViewerPanel from '../components/viewer/ViewerPanel';
import './ViewerPage.css';

const DEBUG = import.meta.env.DEV;

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

  const showHeatmap = useMemo(() => preview?.ndim >= 2, [preview]);
  const displayDimsKey = useMemo(() => {
    if (!Array.isArray(displayDims) || displayDims.length !== 2) return '';
    return displayDims.join(',');
  }, [displayDims]);
  const fixedIndicesKey = useMemo(() => buildFixedIndicesParam(fixedIndices) || '', [fixedIndices]);

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
  }, [fileKey, selectedPath]);

  useEffect(() => {
    if (preview && displayTab === 'heatmap' && preview.ndim < 2) {
      setDisplayTab('table');
    }
  }, [preview, displayTab]);

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
        />
      </section>
    </div>
  );
}

export default ViewerPage;
