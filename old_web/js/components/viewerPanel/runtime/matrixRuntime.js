import { getFileData } from "../../../api/hdf5Service.js";
import {
  MATRIX_ROW_HEIGHT,
  MATRIX_COL_WIDTH,
  MATRIX_HEADER_HEIGHT,
  MATRIX_INDEX_WIDTH,
  MATRIX_OVERSCAN,
  MATRIX_BLOCK_CACHE,
  MATRIX_PENDING,
  toSafeInteger,
  formatCell,
} from "../shared.js";
import { buildMatrixSelectionKey, buildMatrixBlockKey } from "../render/config.js";
import {
  MATRIX_RUNTIME_CLEANUPS,
  ensureNodePool,
  setMatrixStatus,
} from "./common.js";
function getCachedMatrixBlock(runtime, rowOffset, colOffset, rowLimit, colLimit) {
  const blockKey = buildMatrixBlockKey(
    runtime.selectionKey,
    rowOffset,
    colOffset,
    rowLimit,
    colLimit
  );
  return MATRIX_BLOCK_CACHE.get(blockKey) || null;
}

function getMatrixCellValue(runtime, row, col) {
  const rowOffset = Math.floor(row / runtime.blockRows) * runtime.blockRows;
  const colOffset = Math.floor(col / runtime.blockCols) * runtime.blockCols;
  const rowLimit = Math.min(runtime.blockRows, runtime.rows - rowOffset);
  const colLimit = Math.min(runtime.blockCols, runtime.cols - colOffset);
  const block = getCachedMatrixBlock(runtime, rowOffset, colOffset, rowLimit, colLimit);

  if (!block || !Array.isArray(block.data)) {
    return null;
  }

  const resolvedRowOffset = toSafeInteger(block.row_offset, rowOffset);
  const resolvedColOffset = toSafeInteger(block.col_offset, colOffset);
  const localRow = row - resolvedRowOffset;
  const localCol = col - resolvedColOffset;
  return block.data?.[localRow]?.[localCol] ?? null;
}

function initializeMatrixRuntime(shell) {
  if (!shell || shell.dataset.matrixBound === "true") {
    return;
  }

  const table = shell.querySelector("[data-matrix-table]");
  const headerCellsLayer = shell.querySelector("[data-matrix-header-cells]");
  const indexLayer = shell.querySelector("[data-matrix-index]");
  const cellsLayer = shell.querySelector("[data-matrix-cells]");
  const statusElement =
    shell.closest(".data-section")?.querySelector("[data-matrix-status]") || null;

  if (!table || !headerCellsLayer || !indexLayer || !cellsLayer) {
    return;
  }

  const rows = Math.max(0, toSafeInteger(shell.dataset.matrixRows, 0));
  const cols = Math.max(0, toSafeInteger(shell.dataset.matrixCols, 0));
  const blockRows = Math.max(1, toSafeInteger(shell.dataset.matrixBlockRows, 200));
  const blockCols = Math.max(1, toSafeInteger(shell.dataset.matrixBlockCols, 50));
  const fileKey = shell.dataset.matrixFileKey || "";
  const fileEtag = shell.dataset.matrixFileEtag || "";
  const path = shell.dataset.matrixPath || "/";
  const displayDims = shell.dataset.matrixDisplayDims || "";
  const fixedIndices = shell.dataset.matrixFixedIndices || "";
  const selectionKey =
    shell.dataset.matrixSelectionKey ||
    buildMatrixSelectionKey(fileKey, path, displayDims, fixedIndices);
  const notation = shell.dataset.matrixNotation || "auto";

  if (!rows || !cols || !fileKey) {
    setMatrixStatus(statusElement, "No matrix data available.", "error");
    return;
  }

  shell.dataset.matrixBound = "true";

  const runtime = {
    rows,
    cols,
    blockRows,
    blockCols,
    fileKey,
    fileEtag,
    path,
    displayDims,
    fixedIndices,
    selectionKey,
    notation,
    pendingCount: 0,
    loadedBlocks: 0,
    destroyed: false,
    rafToken: null,
    headerPool: [],
    rowIndexPool: [],
    cellPool: [],
  };

  const visible = {
    rowStart: 0,
    rowEnd: 0,
    colStart: 0,
    colEnd: 0,
  };

  function queueRender() {
    if (runtime.destroyed || runtime.rafToken !== null) {
      return;
    }

    runtime.rafToken = requestAnimationFrame(() => {
      runtime.rafToken = null;
      renderViewport();
    });
  }

  function updateStatusFromRuntime() {
    if (runtime.pendingCount > 0) {
      setMatrixStatus(statusElement, "Loading blocks...", "info");
      return;
    }

    setMatrixStatus(
      statusElement,
      runtime.loadedBlocks > 0
        ? `Loaded ${runtime.loadedBlocks} block${runtime.loadedBlocks > 1 ? "s" : ""}.`
        : "Scroll to stream blocks.",
      "info"
    );
  }

  async function requestBlock(rowOffset, colOffset, rowLimit, colLimit) {
    const safeRowLimit = Math.min(rowLimit, Math.max(0, runtime.rows - rowOffset));
    const safeColLimit = Math.min(colLimit, Math.max(0, runtime.cols - colOffset));

    if (safeRowLimit <= 0 || safeColLimit <= 0) {
      return;
    }

    const blockKey = buildMatrixBlockKey(
      runtime.selectionKey,
      rowOffset,
      colOffset,
      safeRowLimit,
      safeColLimit
    );

    if (MATRIX_BLOCK_CACHE.get(blockKey) || MATRIX_PENDING.has(blockKey)) {
      return;
    }

    MATRIX_PENDING.add(blockKey);
    runtime.pendingCount += 1;
    updateStatusFromRuntime();

    const params = {
      mode: "matrix",
      row_offset: rowOffset,
      row_limit: safeRowLimit,
      col_offset: colOffset,
      col_limit: safeColLimit,
    };

    if (runtime.displayDims) {
      params.display_dims = runtime.displayDims;
    }

    if (runtime.fixedIndices) {
      params.fixed_indices = runtime.fixedIndices;
    }

    if (runtime.fileEtag) {
      params.etag = runtime.fileEtag;
    }

    try {
      const response = await getFileData(runtime.fileKey, runtime.path, params, {
        cancelPrevious: false,
      });

      MATRIX_BLOCK_CACHE.set(blockKey, response);
      runtime.loadedBlocks += 1;

      if (!runtime.destroyed) {
        queueRender();
      }
    } catch (error) {
      if (!runtime.destroyed) {
        setMatrixStatus(
          statusElement,
          error?.message || "Failed to load matrix block.",
          "error"
        );
      }
    } finally {
      MATRIX_PENDING.delete(blockKey);
      runtime.pendingCount = Math.max(0, runtime.pendingCount - 1);
      if (!runtime.destroyed) {
        updateStatusFromRuntime();
      }
    }
  }

  function requestVisibleBlocks() {
    const blockRowStart = Math.floor(visible.rowStart / runtime.blockRows) * runtime.blockRows;
    const blockRowEnd = Math.floor(visible.rowEnd / runtime.blockRows) * runtime.blockRows;
    const blockColStart = Math.floor(visible.colStart / runtime.blockCols) * runtime.blockCols;
    const blockColEnd = Math.floor(visible.colEnd / runtime.blockCols) * runtime.blockCols;

    for (let row = blockRowStart; row <= blockRowEnd; row += runtime.blockRows) {
      const rowLimit = Math.min(runtime.blockRows, runtime.rows - row);
      for (let col = blockColStart; col <= blockColEnd; col += runtime.blockCols) {
        const colLimit = Math.min(runtime.blockCols, runtime.cols - col);
        void requestBlock(row, col, rowLimit, colLimit);
      }
    }
  }

  function renderViewport() {
    if (runtime.destroyed) {
      return;
    }

    const viewportWidth = table.clientWidth;
    const viewportHeight = table.clientHeight;
    const scrollTop = table.scrollTop;
    const scrollLeft = table.scrollLeft;

    const contentScrollTop = Math.max(0, scrollTop - MATRIX_HEADER_HEIGHT);
    const contentScrollLeft = Math.max(0, scrollLeft - MATRIX_INDEX_WIDTH);
    const contentHeight = Math.max(0, viewportHeight - MATRIX_HEADER_HEIGHT);
    const contentWidth = Math.max(0, viewportWidth - MATRIX_INDEX_WIDTH);

    visible.rowStart = Math.max(
      0,
      Math.floor(contentScrollTop / MATRIX_ROW_HEIGHT) - MATRIX_OVERSCAN
    );
    visible.rowEnd = Math.min(
      runtime.rows - 1,
      Math.floor((contentScrollTop + contentHeight) / MATRIX_ROW_HEIGHT) + MATRIX_OVERSCAN
    );
    visible.colStart = Math.max(
      0,
      Math.floor(contentScrollLeft / MATRIX_COL_WIDTH) - MATRIX_OVERSCAN
    );
    visible.colEnd = Math.min(
      runtime.cols - 1,
      Math.floor((contentScrollLeft + contentWidth) / MATRIX_COL_WIDTH) + MATRIX_OVERSCAN
    );

    requestVisibleBlocks();

    const visibleCols = [];
    for (let col = visible.colStart; col <= visible.colEnd; col += 1) {
      visibleCols.push(col);
    }

    const visibleRows = [];
    for (let row = visible.rowStart; row <= visible.rowEnd; row += 1) {
      visibleRows.push(row);
    }

    ensureNodePool(
      headerCellsLayer,
      runtime.headerPool,
      visibleCols.length,
      "matrix-cell matrix-cell-header"
    );
    visibleCols.forEach((col, index) => {
      const node = runtime.headerPool[index];
      node.style.left = `${col * MATRIX_COL_WIDTH}px`;
      node.style.width = `${MATRIX_COL_WIDTH}px`;
      node.style.height = `${MATRIX_HEADER_HEIGHT}px`;
      node.textContent = String(col);
    });

    indexLayer.style.transform = "";
    ensureNodePool(
      indexLayer,
      runtime.rowIndexPool,
      visibleRows.length,
      "matrix-cell matrix-cell-index"
    );
    visibleRows.forEach((row, index) => {
      const node = runtime.rowIndexPool[index];
      node.style.left = "0px";
      node.style.top = `${row * MATRIX_ROW_HEIGHT}px`;
      node.style.width = `${MATRIX_INDEX_WIDTH}px`;
      node.style.height = `${MATRIX_ROW_HEIGHT}px`;
      node.textContent = String(row);
    });

    const totalCellCount = visibleRows.length * visibleCols.length;
    ensureNodePool(cellsLayer, runtime.cellPool, totalCellCount, "matrix-cell");

    let cursor = 0;
    visibleRows.forEach((row) => {
      visibleCols.forEach((col) => {
        const node = runtime.cellPool[cursor];
        cursor += 1;

        node.style.top = `${row * MATRIX_ROW_HEIGHT}px`;
        node.style.left = `${col * MATRIX_COL_WIDTH}px`;
        node.style.width = `${MATRIX_COL_WIDTH}px`;
        node.style.height = `${MATRIX_ROW_HEIGHT}px`;

        const value = getMatrixCellValue(runtime, row, col);
        node.textContent = value === null ? "--" : formatCell(value, runtime.notation);
      });
    });
  }

  const onScroll = () => {
    queueRender();
  };
  table.addEventListener("scroll", onScroll, { passive: true });

  let resizeObserver = null;
  const onWindowResize = () => {
    queueRender();
  };

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(onWindowResize);
    resizeObserver.observe(table);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  updateStatusFromRuntime();
  queueRender();

  const cleanup = () => {
    runtime.destroyed = true;
    table.removeEventListener("scroll", onScroll);
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", onWindowResize);
    }
    if (runtime.rafToken !== null) {
      cancelAnimationFrame(runtime.rafToken);
      runtime.rafToken = null;
    }
  };

  MATRIX_RUNTIME_CLEANUPS.add(cleanup);
}

export { initializeMatrixRuntime };
