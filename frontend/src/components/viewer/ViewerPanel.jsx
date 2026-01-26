import PropTypes from 'prop-types';
import './ViewerPanel.css';

const formatValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(' × ');
  }
  if (value === null || value === undefined) {
    return '--';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
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

function ViewerPanel({ fileKey, selectedPath, viewMode, meta, loading, error }) {
  const isInspect = viewMode === 'inspect';
  const isDataset = meta?.kind === 'dataset';
  const isGroup = meta?.kind === 'group';

  return (
    <div className={`viewer-panel ${isInspect ? 'is-inspect' : ''}`}>
      <div className="panel-canvas">
        {!isInspect && (
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
            {/* Basic Information */}
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

            {/* Dataset Type Information */}
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

            {/* Dataset Properties */}
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

            {/* Compression & Filters */}
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

            {/* Raw Type Information */}
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

            {/* Attributes */}
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

            {/* Raw JSON */}
            <div className="info-section-title">Raw JSON</div>
            <pre className="json-view">{JSON.stringify(meta, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

ViewerPanel.propTypes = {
  fileKey: PropTypes.string,
  selectedPath: PropTypes.string,
  viewMode: PropTypes.string.isRequired,
  meta: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string
};

export default ViewerPanel;
