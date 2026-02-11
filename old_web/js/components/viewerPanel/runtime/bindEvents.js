import { clearViewerRuntimeBindings } from "./common.js";
import { initializeMatrixRuntime } from "./matrixRuntime.js";
import { initializeLineRuntime } from "./lineRuntime.js";
import { initializeHeatmapRuntime } from "./heatmapRuntime.js?v=20260211-2";
export function bindViewerPanelEvents(root, actions) {
  clearViewerRuntimeBindings();

  root.querySelectorAll("[data-axis-change]").forEach((button) => {
    button.addEventListener("click", () => {
      const axis = button.dataset.axisChange || "x";
      const dim = Number(button.dataset.axisDim);
      actions.setDisplayAxis(axis, dim);
    });
  });

  root.querySelectorAll("[data-display-dim-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const index = Number(select.dataset.dimIndex);
      const dim = Number(select.value);
      actions.setDisplayDim(index, dim);
    });
  });

  root.querySelectorAll("[data-fixed-index-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-fixed-index-number]").forEach((input) => {
    input.addEventListener("change", () => {
      const dim = Number(input.dataset.fixedDim);
      const size = Number(input.dataset.fixedSize);
      actions.stageFixedIndex(dim, Number(input.value), size);
    });
  });

  root.querySelectorAll("[data-dim-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.applyDisplayConfig();
    });
  });

  root.querySelectorAll("[data-dim-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.resetDisplayConfigFromPreview();
    });
  });

  root.querySelectorAll("[data-matrix-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableMatrixFullView();
    });
  });

  root.querySelectorAll("[data-line-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableLineFullView();
    });
  });

  root.querySelectorAll("[data-heatmap-enable]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.enableHeatmapFullView();
    });
  });

  root.querySelectorAll("[data-matrix-shell]").forEach((shell) => {
    initializeMatrixRuntime(shell);
  });

  root.querySelectorAll("[data-line-shell]").forEach((shell) => {
    initializeLineRuntime(shell);
  });

  root.querySelectorAll("[data-heatmap-shell]").forEach((shell) => {
    initializeHeatmapRuntime(shell);
  });
}
