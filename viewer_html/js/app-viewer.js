// Viewer HTML module: Bootstraps viewer lifecycle, validates dependencies, parses deep links, and wires state-driven rendering.
(function (global) {
  "use strict";

  var ns = global.HDFViewer;
  if (!ns) {
    console.error("[HDFViewer] Missing namespace for app-viewer.");
    return;
  }

  var ensurePath = ns.core && ns.core.ensurePath;
  if (typeof ensurePath !== "function") {
    console.error("[HDFViewer] Missing core.ensurePath before loading app-viewer.");
    return;
  }

  var moduleState = ensurePath(ns, "app.viewerBoot");
  var root = document.getElementById("viewer-app");
  var renderQueued = false;

  function setBootFailureStatus(message) {
    var statusNode = document.getElementById("global-status");
    if (!statusNode) {
      return;
    }

    statusNode.textContent = String(message || "Viewer bootstrap failed.");
    statusNode.classList.remove("info");
    statusNode.classList.add("error");
  }

  function resolveActions() {
    if (typeof actions !== "undefined" && actions && typeof actions === "object") {
      return actions;
    }
    if (ns.state && ns.state.actions && typeof ns.state.actions === "object") {
      return ns.state.actions;
    }
    return {};
  }

  function verifyRuntimeDependencies() {
    var missingGlobals = [];

    if (typeof getState !== "function") {
      missingGlobals.push("getState");
    }
    if (typeof subscribe !== "function") {
      missingGlobals.push("subscribe");
    }
    if (typeof renderViewerView !== "function") {
      missingGlobals.push("renderViewerView");
    }
    if (typeof bindViewerViewEvents !== "function") {
      missingGlobals.push("bindViewerViewEvents");
    }

    var missingModules = [];
    var requiredModules = [
      "core/namespace",
      "core/config",
      "core/domRefs",
      "utils/format",
      "api/client",
      "api/contracts",
      "api/hdf5Service",
      "state/store",
      "state/reducers",
      "components/sidebarTree",
      "components/viewerPanel",
      "views/viewerView",
    ];

    if (ns.core && typeof ns.core.requireModules === "function") {
      var requirement = ns.core.requireModules(requiredModules, "app-viewer");
      if (!requirement.ok) {
        missingModules = requirement.missing || [];
      }
    }

    var hasRoot = !!root;
    if (!hasRoot) {
      missingGlobals.push("#viewer-app");
    }

    if (missingGlobals.length > 0 || missingModules.length > 0) {
      console.error("[HDFViewer] Runtime dependency check failed.", {
        missingGlobals: missingGlobals,
        missingModules: missingModules,
      });
      return {
        ok: false,
        missingGlobals: missingGlobals,
        missingModules: missingModules,
      };
    }

    return {
      ok: true,
      missingGlobals: [],
      missingModules: [],
    };
  }

  function queueRender() {
    if (renderQueued) {
      return;
    }

    renderQueued = true;
    var schedule =
      typeof window !== "undefined" && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : function (cb) {
            return setTimeout(cb, 16);
          };

    schedule(function () {
      renderQueued = false;
      renderApp();
    });
  }

  function renderApp() {
    if (!root) {
      return;
    }

    if (typeof getState !== "function" || typeof renderViewerView !== "function") {
      return;
    }

    var state = getState();
    var missingFile = state && state.viewerBlocked === true;

    renderViewerView(state, {
      missingFile: missingFile,
      deepLinkExample: "?file=<url-encoded-object-key>&bucket=<bucket-name>",
    });

    if (typeof bindViewerViewEvents === "function") {
      bindViewerViewEvents(root, resolveActions());
    }
  }

  async function bootstrapApp() {
    var deps = verifyRuntimeDependencies();
    if (!deps.ok) {
      setBootFailureStatus("Viewer bootstrap failed: missing runtime dependencies.");
      return;
    }

    if (typeof validateViewerDomIds === "function") {
      var validation = validateViewerDomIds(document);
      if (!validation.ok) {
        setBootFailureStatus(
          "Viewer bootstrap failed: missing required DOM IDs (" +
            validation.missing.join(", ") +
            ")."
        );
        return;
      }
    }

    if (typeof initViewerViewTemplate === "function") {
      await Promise.allSettled([initViewerViewTemplate()]);
    }

    if (typeof subscribe === "function") {
      subscribe(queueRender);
    }

    var actionsApi = resolveActions();
    var mql = window.matchMedia("(max-width: 1024px)");

    function handleViewportChange(e) {
      if (typeof actionsApi.setSidebarOpen === "function") {
        actionsApi.setSidebarOpen(!e.matches);
      }
    }

    if (mql.addEventListener) {
      mql.addEventListener("change", handleViewportChange);
    } else if (mql.addListener) {
      mql.addListener(handleViewportChange);
    }

    if (mql.matches && typeof actionsApi.setSidebarOpen === "function") {
      actionsApi.setSidebarOpen(false);
    }

    var params = new URLSearchParams(location.search);
    var deepLinkKey = params.get("file");
    var deepLinkBucket = params.get("bucket");
    var hasFile = Boolean(deepLinkKey);

    if (hasFile && typeof actionsApi.openViewer === "function") {
      history.replaceState({}, "", location.pathname);
      actionsApi.openViewer({
        key: deepLinkKey,
        etag: null,
        bucket: deepLinkBucket || null,
      });

      if (typeof actionsApi.loadFiles === "function") {
        void actionsApi.loadFiles();
      }
    } else {
      if (typeof actionsApi.goHome === "function") {
        actionsApi.goHome();
      }
      if (typeof clearViewerRuntimeBindings === "function") {
        clearViewerRuntimeBindings();
      }
    }

    renderApp();
  }

  void bootstrapApp();

  moduleState.queueRender = queueRender;
  moduleState.renderApp = renderApp;
  moduleState.bootstrapApp = bootstrapApp;
  moduleState.verifyRuntimeDependencies = verifyRuntimeDependencies;

  global.queueRender = queueRender;
  global.renderApp = renderApp;
  global.bootstrapApp = bootstrapApp;
  global.verifyRuntimeDependencies = verifyRuntimeDependencies;

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("app-viewer");
  }
})(typeof window !== "undefined" ? window : globalThis);

