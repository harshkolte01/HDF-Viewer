function PreviewToolbar({
  activeTab,
  onTabChange,
  showHeatmap,
  onExport,
  disabled,
  notation,
  onNotationChange,
  lineGrid,
  onLineGridChange,
  lineAspect,
  onLineAspectChange
}) {
  const handleNotation = (value) => {
    if (disabled) return;
    onNotationChange?.(value);
  };

  const handleLineGrid = () => {
    if (disabled) return;
    onLineGridChange?.(!lineGrid);
  };

  const handleLineAspect = (value) => {
    if (disabled) return;
    onLineAspectChange?.(value);
  };

  return (
    <div className="viewer-subbar">
      <div className="subbar-tabs">
        <button
          type="button"
          className={`subbar-tab ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => onTabChange('table')}
          disabled={disabled}
        >
          Matrix
        </button>
        <button
          type="button"
          className={`subbar-tab ${activeTab === 'line' ? 'active' : ''}`}
          onClick={() => onTabChange('line')}
          disabled={disabled}
        >
          Line Graph
        </button>
        {showHeatmap && (
          <button
            type="button"
            className={`subbar-tab ${activeTab === 'heatmap' ? 'active' : ''}`}
            onClick={() => onTabChange('heatmap')}
            disabled={disabled}
          >
            Heatmap
          </button>
        )}
      </div>
      {activeTab === 'line' ? (
        <div className="subbar-actions">
          <button
            type="button"
            className={`subbar-toggle ${lineGrid ? 'active' : ''}`}
            onClick={handleLineGrid}
            disabled={disabled}
          >
            Grid
          </button>
          <div className="aspect-group">
            <span className="aspect-label">Aspect</span>
            <div className="aspect-tabs">
              {['line', 'point', 'both'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`aspect-tab ${lineAspect === value ? 'active' : ''}`}
                  onClick={() => handleLineAspect(value)}
                  disabled={disabled}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="subbar-export"
            onClick={onExport}
            disabled={disabled}
          >
            Export
          </button>
        </div>
      ) : (
        <div className="subbar-actions">
          <div className="notation-group">
            <span className="notation-label">Notation</span>
            <div className="notation-tabs">
              {['auto', 'scientific', 'exact'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`notation-tab ${notation === value ? 'active' : ''}`}
                  onClick={() => handleNotation(value)}
                  disabled={disabled}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="subbar-export"
            onClick={onExport}
            disabled={disabled}
          >
            Export
          </button>
        </div>
      )}
    </div>
  );
}

export default PreviewToolbar;
