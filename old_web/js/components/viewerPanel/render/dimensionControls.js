import { getDefaultDisplayDims, resolveDisplayControls } from "../shared.js";
function renderDimensionControls(state, preview) {
  const ndim = Number(preview?.ndim || 0);
  if (ndim < 2) {
    return "";
  }

  const controls = resolveDisplayControls(state, preview);
  const shape = controls.shape;
  const appliedDims = controls.appliedDisplayDims || getDefaultDisplayDims(shape);
  const stagedDims = controls.stagedDisplayDims || appliedDims || [0, 1];
  const stagedFixed = controls.stagedFixedIndices || {};

  if (!appliedDims || !stagedDims) {
    return "";
  }

  const dimLabel = `D${appliedDims[0]} x D${appliedDims[1]}`;
  const pendingLabel = `D${stagedDims[0]} x D${stagedDims[1]}`;

  if (ndim === 2) {
    const xDim = stagedDims[1];
    const yDim = stagedDims[0];

    return `
      <aside class="preview-sidebar">
        <button type="button" class="sidebar-collapse-btn" data-sidebar-toggle="true">
          <svg class="sidebar-collapse-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Dimensions</span>
          <span class="dim-value-inline">${dimLabel}</span>
        </button>
        <div class="sidebar-body">
        <div class="dimension-summary">
          <span class="dim-label">Display dims</span>
          <span class="dim-value">${dimLabel}</span>
        </div>
        <div class="axis-toggle">
          <div class="axis-row">
            <span class="axis-label">x</span>
            <div class="axis-options">
              ${[0, 1]
                .map(
                  (dim) => `
                    <button
                      type="button"
                      class="axis-btn ${xDim === dim ? "active" : ""}"
                      data-axis-change="x"
                      data-axis-dim="${dim}"
                    >
                      D${dim}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="axis-row">
            <span class="axis-label">y</span>
            <div class="axis-options">
              ${[0, 1]
                .map(
                  (dim) => `
                    <button
                      type="button"
                      class="axis-btn ${yDim === dim ? "active" : ""}"
                      data-axis-change="y"
                      data-axis-dim="${dim}"
                    >
                      D${dim}
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
        </div>
      </aside>
    `;
  }

  const dimOptions = shape.map((size, idx) => ({ idx, size }));
  const xOptions = dimOptions;
  const yOptions = dimOptions.filter((option) => option.idx !== stagedDims[0]);
  const safeYDim = yOptions.some((option) => option.idx === stagedDims[1])
    ? stagedDims[1]
    : yOptions[0]?.idx;

  return `
    <aside class="preview-sidebar">
      <button type="button" class="sidebar-collapse-btn" data-sidebar-toggle="true">
        <svg class="sidebar-collapse-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Dimensions</span>
        <span class="dim-value-inline">${dimLabel}</span>
      </button>
      <div class="sidebar-body">
      <div class="dimension-summary">
        <span class="dim-label">Display dims</span>
        <span class="dim-value">${dimLabel}</span>
        ${
          controls.hasPendingChanges
            ? `<span class="dim-pending">Pending: ${pendingLabel} (click Set)</span>`
            : ""
        }
      </div>

      <div class="dimension-controls">
        <div class="dim-group">
          <label>Display dim A</label>
          <select data-display-dim-select="true" data-dim-index="0">
            ${xOptions
              .map(
                (option) => `
                  <option value="${option.idx}" ${stagedDims[0] === option.idx ? "selected" : ""}>
                    D${option.idx} (size ${option.size})
                  </option>
                `
              )
              .join("")}
          </select>
        </div>

        <div class="dim-group">
          <label>Display dim B</label>
          <select data-display-dim-select="true" data-dim-index="1">
            ${yOptions
              .map(
                (option) => `
                  <option value="${option.idx}" ${safeYDim === option.idx ? "selected" : ""}>
                    D${option.idx} (size ${option.size})
                  </option>
                `
              )
              .join("")}
          </select>
        </div>

        <div class="dim-sliders">
          ${shape
            .map((size, dim) => {
              if (stagedDims.includes(dim)) {
                return "";
              }

              const max = Math.max(0, size - 1);
              const current = Number.isFinite(stagedFixed[dim]) ? stagedFixed[dim] : Math.floor(size / 2);

              return `
                <div class="dim-slider">
                  <label>Dim ${dim} index</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="${max}"
                      value="${current}"
                      data-fixed-index-range="true"
                      data-fixed-dim="${dim}"
                      data-fixed-size="${size}"
                    />
                    <input
                      type="number"
                      min="0"
                      max="${max}"
                      value="${current}"
                      data-fixed-index-number="true"
                      data-fixed-dim="${dim}"
                      data-fixed-size="${size}"
                    />
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="dim-controls-buttons">
          <button type="button" class="dim-set-btn" data-dim-apply="true">Set</button>
          <button type="button" class="dim-reset-btn" data-dim-reset="true">Reset</button>
        </div>
      </div>
      </div>
    </aside>
  `;
}

export { renderDimensionControls };
