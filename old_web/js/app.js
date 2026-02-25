import { subscribe, getState } from "./state/store.js";
import { actions } from "./state/reducers.js?v=20260212-2";
import { renderTopBar, bindTopBarEvents } from "./components/topBar.js";
import {
  initHomeViewTemplate,
  renderHomeView,
  bindHomeViewEvents,
} from "./views/homeView.js";
import {
  initViewerViewTemplate,
  renderViewerView,
  bindViewerViewEvents,
  clearViewerViewBindings,
} from "./views/viewerView.js?v=20260225-2";
import { clearViewerRuntimeBindings } from "./components/viewerPanel/runtime/common.js";

const root = document.getElementById("app-root");
let renderQueued = false;

function queueRender() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  const schedule = typeof window !== "undefined" && window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (cb) => setTimeout(cb, 16);

  schedule(() => {
    renderQueued = false;
    renderApp();
  });
}

function renderApp() {
  if (!root) {
    return;
  }

  const state = getState();
  if (state.route !== "viewer") {
    clearViewerViewBindings();
    clearViewerRuntimeBindings();
  }

  if (state.route === "viewer") {
    root.innerHTML = renderViewerView(state);
  } else {
    root.innerHTML = `
      <div class="app">
        ${renderTopBar(state)}
        <main class="main-content">
          <div class="container">${renderHomeView(state)}</div>
        </main>
      </div>
    `;
  }

  bindTopBarEvents(root, actions);

  if (state.route === "viewer") {
    bindViewerViewEvents(root, actions);
  } else {
    bindHomeViewEvents(root, actions);
  }
}

async function bootstrapApp() {
  await Promise.allSettled([initHomeViewTemplate(), initViewerViewTemplate()]);
  subscribe(queueRender);

  /* Auto-collapse sidebar on narrow viewports */
  const mql = window.matchMedia("(max-width: 1024px)");
  function handleViewportChange(e) {
    actions.setSidebarOpen(!e.matches);
  }
  mql.addEventListener("change", handleViewportChange);
  if (mql.matches) {
    actions.setSidebarOpen(false);
  }

  renderApp();
  void actions.loadFiles();
}

void bootstrapApp();

