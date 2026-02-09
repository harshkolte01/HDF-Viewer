import { escapeHtml } from "../utils/format.js";

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(" x ");
  }

  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatCell(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  return String(value);
}

function formatTypeDescription(typeInfo) {
  if (!typeInfo || typeof typeInfo === "string") {
    return typeInfo || "Unknown";
  }

  const parts = [];
  if (typeInfo.class) parts.push(typeInfo.class);
  if (typeInfo.signed !== undefined) parts.push(typeInfo.signed ? "signed" : "unsigned");
  if (typeInfo.size) parts.push(`${typeInfo.size}-bit`);
  if (typeInfo.endianness) parts.push(typeInfo.endianness);

  return parts.join(", ");
}

function renderTablePreview(preview) {
  const data = Array.isArray(preview?.table?.data)
    ? preview.table.data
    : Array.isArray(preview?.data)
    ? preview.data
    : [];

  if (!data.length) {
    return '<div class="panel-state"><div class="state-text">No table rows available in preview response.</div></div>';
  }

  const rows = data.slice(0, 50).map((row, rowIndex) => {
    const cells = (Array.isArray(row) ? row : [row])
      .slice(0, 30)
      .map((value) => `<td>${escapeHtml(formatCell(value))}</td>`)
      .join("");
    return `
      <tr>
        <td class="row-index">${rowIndex}</td>
        ${cells}
      </tr>
    `;
  });

  const colCount = Array.isArray(data[0]) ? data[0].length : 1;
  const headCells = Array.from({ length: Math.min(colCount, 30) }, (_, index) => `<th>${index}</th>`).join("");

  return `
    <div class="preview-table-wrapper">
      <table class="preview-table">
        <thead>
          <tr>
            <th>#</th>
            ${headCells}
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function renderLinePreview(preview) {
  const source = preview?.profile || preview?.plot || {};
  const xSize = Array.isArray(source.x) ? source.x.length : 0;
  const ySize = Array.isArray(source.y) ? source.y.length : 0;

  return `
    <div class="line-chart-shell">
      <div class="line-chart-toolbar">
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn active">Line</button>
          <button type="button" class="line-tool-btn">Point</button>
          <button type="button" class="line-tool-btn">Both</button>
        </div>
        <div class="line-zoom-label">Points: ${Math.max(xSize, ySize)}</div>
      </div>
      <div class="line-chart-stage">
        <div class="line-chart-canvas"></div>
      </div>
      <div class="line-stats">
        <span>x-size: ${xSize}</span>
        <span>y-size: ${ySize}</span>
      </div>
    </div>
  `;
}

function renderHeatmapPreview(preview) {
  const shape = Array.isArray(preview?.shape) ? preview.shape : [];

  return `
    <div class="line-chart-shell heatmap-chart-shell">
      <div class="line-chart-toolbar">
        <div class="line-tool-group">
          <button type="button" class="line-tool-btn active">Heatmap</button>
        </div>
        <div class="line-zoom-label">Shape: ${escapeHtml(formatValue(shape))}</div>
      </div>
      <div class="line-chart-stage">
        <div class="line-chart-canvas heatmap-chart-canvas"></div>
      </div>
    </div>
  `;
}

function renderDisplayContent(state) {
  const hasSelection = state.selectedNodeType === "dataset" && state.selectedPath !== "/";
  const activeTab = state.displayTab || "table";
  const preview = state.preview;

  if (!hasSelection) {
    return `
      <div class="panel-state">
        <div class="state-text">Select a dataset from the tree to view a preview.</div>
      </div>
    `;
  }

  if (state.previewLoading) {
    return `
      <div class="panel-state">
        <div class="loading-spinner"></div>
        <div class="state-text">Loading preview...</div>
      </div>
    `;
  }

  if (state.previewError) {
    return `
      <div class="panel-state error">
        <div class="state-text error-text">${escapeHtml(state.previewError)}</div>
      </div>
    `;
  }

  if (!preview) {
    return `
      <div class="panel-state">
        <div class="state-text">No preview available yet.</div>
      </div>
    `;
  }

  const displayDims = Array.isArray(state.displayConfig?.displayDims)
    ? state.displayConfig.displayDims
    : [0, 1];

  let dataSection = renderTablePreview(preview);
  if (activeTab === "line") {
    dataSection = renderLinePreview(preview);
  } else if (activeTab === "heatmap") {
    dataSection = renderHeatmapPreview(preview);
  }

  return `
    <div class="preview-shell">
      <div class="preview-layout ${activeTab === "line" ? "is-line" : ""}">
        ${
          Number(preview.ndim || 0) >= 2
            ? `<aside class="preview-sidebar">
                 <div class="dimension-summary">
                   <span class="dim-label">Display dims</span>
                   <span class="dim-value">D${displayDims[0]} x D${displayDims[1]}</span>
                 </div>
               </aside>`
            : ""
        }
        <div class="preview-content">
          <div class="data-section">${dataSection}</div>
        </div>
      </div>
    </div>
  `;
}

function renderInspectContent(state) {
  const hasSelection = state.selectedPath !== "/";

  if (!hasSelection) {
    return `
      <div class="panel-state">
        <div class="state-text">Select an item from the tree to view its metadata.</div>
      </div>
    `;
  }

  if (state.metadataLoading) {
    return `
      <div class="panel-state">
        <div class="loading-spinner"></div>
        <div class="state-text">Loading metadata...</div>
      </div>
    `;
  }

  if (state.metadataError) {
    return `
      <div class="panel-state error">
        <div class="state-text error-text">${escapeHtml(state.metadataError)}</div>
      </div>
    `;
  }

  const meta = state.metadata;
  if (!meta) {
    return `
      <div class="panel-state">
        <div class="state-text">No metadata available.</div>
      </div>
    `;
  }

  const infoRows = [
    ["Name", meta.name || "(root)", false],
    ["Path", meta.path || state.selectedPath, true],
    ["Kind", meta.kind || state.selectedNodeType || "--", false],
  ];

  if (meta.num_children !== undefined) {
    infoRows.push(["Children", meta.num_children, false]);
  }

  if (meta.type) {
    infoRows.push(["Type", formatTypeDescription(meta.type), false]);
  }

  if (meta.shape) {
    infoRows.push(["Shape", `[${formatValue(meta.shape)}]`, true]);
  }

  if (meta.ndim !== undefined) {
    infoRows.push(["Dimensions", `${meta.ndim}D`, false]);
  }

  if (meta.size !== undefined) {
    infoRows.push(["Total Elements", Number(meta.size).toLocaleString(), false]);
  }

  if (meta.dtype) {
    infoRows.push(["DType", meta.dtype, true]);
  }

  if (meta.chunks) {
    infoRows.push(["Chunks", `[${formatValue(meta.chunks)}]`, true]);
  }

  if (meta.compression) {
    infoRows.push([
      "Compression",
      `${meta.compression}${meta.compression_opts ? ` (level ${meta.compression_opts})` : ""}`,
      false,
    ]);
  }

  return `
    <div class="metadata-simple">
      ${infoRows
        .map(
          ([label, value, mono]) => `
            <div class="info-row">
              <span class="info-label">${escapeHtml(String(label))}</span>
              <span class="info-value ${mono ? "mono" : ""}">${escapeHtml(String(value))}</span>
            </div>
          `
        )
        .join("")}
      <div class="info-section-title">Raw JSON</div>
      <pre class="json-view">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
    </div>
  `;
}

export function renderViewerPanel(state) {
  const isDisplay = state.viewMode === "display";

  return `
    <div class="viewer-panel ${isDisplay ? "is-display" : "is-inspect"}">
      <div class="panel-canvas">
        ${isDisplay ? renderDisplayContent(state) : renderInspectContent(state)}
      </div>
    </div>
  `;
}

export function bindViewerPanelEvents(root, actions) {
  void root;
  void actions;
}
