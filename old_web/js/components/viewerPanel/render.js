import { renderDisplayContent, renderInspectContent } from "./render/sections.js?v=20260220-13";

export function renderViewerPanel(state) {
  const isDisplay = state.viewMode === "display";
  const isLineFixedPage =
    isDisplay &&
    (state.displayTab || "line") === "line" &&
    state.lineFullEnabled === true;

  return `
    <div class="viewer-panel ${isDisplay ? "is-display" : "is-inspect"}">
      <div class="panel-canvas ${isLineFixedPage ? "panel-canvas-line-fixed" : ""}">
        ${isDisplay ? renderDisplayContent(state) : renderInspectContent(state)}
      </div>
    </div>
  `;
}


export { buildLineSelectionKey, buildMatrixSelectionKey, buildMatrixBlockKey } from "./render/config.js";
