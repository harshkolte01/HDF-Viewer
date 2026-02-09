import { subscribe, getState } from "./state/store.js";
import { actions } from "./state/reducers.js";
import { renderTopBar, bindTopBarEvents } from "./components/topBar.js";
import { renderHomeView, bindHomeViewEvents } from "./views/homeView.js";
import { renderViewerView, bindViewerViewEvents } from "./views/viewerView.js";

const root = document.getElementById("app-root");

function renderApp() {
  if (!root) {
    return;
  }

  const state = getState();
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

subscribe(renderApp);
renderApp();
actions.loadFiles();
