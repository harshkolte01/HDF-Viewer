export function renderModeToggle(state) {
  const displayActive = state.viewMode === "display" ? "mode-btn active" : "mode-btn";
  const inspectActive = state.viewMode === "inspect" ? "mode-btn active" : "mode-btn";

  return `
    <div class="mode-toggle">
      <button class="${displayActive}" data-view-mode="display" type="button">Display</button>
      <button class="${inspectActive}" data-view-mode="inspect" type="button">Inspect</button>
    </div>
  `;
}

export function bindModeToggleEvents(root, actions) {
  root.querySelectorAll("[data-view-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      actions.setViewMode(button.dataset.viewMode || "inspect");
    });
  });
}

export const renderToolbar = renderModeToggle;
export const bindToolbarEvents = bindModeToggleEvents;
