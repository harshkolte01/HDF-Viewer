export function renderDimensionControls(state) {
  return `
    <div class="panel-row">
      <span class="panel-label">Display Dims</span>
      <span class="panel-value">${state.displayConfig.displayDims.join(", ")}</span>
    </div>
  `;
}
