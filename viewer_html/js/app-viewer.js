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
  var bootContext = {
    deepLinkKey: null,
    deepLinkBucket: null,
    hasFile: false,
  };

  function resolveActions() {
    return typeof actions !== "undefined" && actions && typeof actions === "object"
      ? actions
      : {};
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
    renderViewerView(state, {
      missingFile: !bootContext.hasFile,
      deepLinkExample: "?file=<url-encoded-object-key>&bucket=<bucket-name>",
    });

    if (typeof bindViewerViewEvents === "function") {
      bindViewerViewEvents(root, resolveActions());
    }
  }

  async function bootstrapApp() {
    var actionsApi = resolveActions();

    if (typeof validateViewerDomIds === "function") {
      var validation = validateViewerDomIds(document);
      if (!validation.ok) {
        return;
      }
    }

    await Promise.allSettled([
      typeof initViewerViewTemplate === "function" ? initViewerViewTemplate() : Promise.resolve(),
    ]);

    if (typeof subscribe === "function") {
      subscribe(queueRender);
    }

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

    bootContext.deepLinkKey = new URLSearchParams(location.search).get("file");
    bootContext.deepLinkBucket = new URLSearchParams(location.search).get("bucket");
    bootContext.hasFile = Boolean(bootContext.deepLinkKey);

    if (bootContext.hasFile && typeof actionsApi.openViewer === "function") {
      history.replaceState({}, "", location.pathname);
      actionsApi.openViewer({
        key: bootContext.deepLinkKey,
        etag: null,
        bucket: bootContext.deepLinkBucket || null,
      });

      if (typeof actionsApi.loadFiles === "function") {
        void actionsApi.loadFiles();
      }
    } else {
      if (typeof clearViewerRuntimeBindings === "function") {
        clearViewerRuntimeBindings();
      }
    }

    renderApp();
  }

  void bootstrapApp();

  if (typeof queueRender !== "undefined") {
    moduleState.queueRender = queueRender;
    global.queueRender = queueRender;
  }
  if (typeof renderApp !== "undefined") {
    moduleState.renderApp = renderApp;
    global.renderApp = renderApp;
  }
  if (typeof bootstrapApp !== "undefined") {
    moduleState.bootstrapApp = bootstrapApp;
    global.bootstrapApp = bootstrapApp;
  }

  if (ns.core && typeof ns.core.registerModule === "function") {
    ns.core.registerModule("app-viewer");
  }
})(typeof window !== "undefined" ? window : globalThis);
