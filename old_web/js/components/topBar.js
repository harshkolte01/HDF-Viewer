export function renderTopBar(state) {
  const refreshButtonClass = state.refreshing ? "refresh-btn refreshing" : "refresh-btn";
  const refreshButtonDisabled = state.refreshing || state.loading ? "disabled" : "";
  const refreshLabel = state.refreshing
    ? '<span class="spinner"></span>Refreshing...'
    : `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
      Refresh
    `;

  return `
    <nav class="navbar">
      <div class="navbar-content">
        <div class="navbar-brand">
          <div class="navbar-logo">H</div>
          <span class="navbar-title">HDF Viewer</span>
        </div>
        <div class="navbar-actions">
          <button id="refresh-btn" class="${refreshButtonClass}" type="button" ${refreshButtonDisabled}>
            ${refreshLabel}
          </button>
        </div>
      </div>
    </nav>
  `;
}

export function bindTopBarEvents(root, actions) {
  const refreshButton = root.querySelector("#refresh-btn");
  if (refreshButton) {
    refreshButton.addEventListener("click", actions.refreshFileList);
  }
}
