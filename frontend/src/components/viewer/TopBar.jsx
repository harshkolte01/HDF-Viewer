function TopBar({ fileKey, selectedPath, viewMode, onModeChange, onBack }) {
  const segments = selectedPath
    ? selectedPath.split('/').filter(Boolean)
    : [];

  return (
    <div className="viewer-topbar">
      <div className="topbar-left">
        <div className="breadcrumb-label">File location</div>
        <div className="breadcrumb">
          <span className="crumb">{fileKey || 'Unknown'}</span>
          {segments.length === 0 && (
            <span className="crumb active">root</span>
          )}
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <span
                key={`${segment}-${index}`}
                className={`crumb ${isLast ? 'active' : ''}`}
              >
                {segment}
              </span>
            );
          })}
        </div>
      </div>

      <div className="topbar-right">
        <button className="ghost-btn" type="button" onClick={onBack}>
          Back to files
        </button>
        <div className="segmented">
          <button
            className={`seg-btn ${viewMode === 'display' ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('display')}
          >
            Display
          </button>
          <button
            className={`seg-btn ${viewMode === 'inspect' ? 'active' : ''}`}
            type="button"
            onClick={() => onModeChange('inspect')}
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
