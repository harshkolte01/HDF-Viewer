import { API_BASE_URL } from "../config.js";

const CSV_BOM = "\uFEFF";

function sanitizeSegment(value, fallback = "dataset") {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function csvEscapeCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function toCsvRow(values = []) {
  return values.map((entry) => csvEscapeCell(entry)).join(",");
}

function buildExportFilename({ fileKey, path, tab, scope, extension }) {
  const filePart = sanitizeSegment(fileKey || "file", "file");
  const pathPart = sanitizeSegment(String(path || "/").replace(/^\/+/, "").replace(/\//g, "_"), "root");
  const tabPart = sanitizeSegment(tab || "data", "data");
  const scopePart = sanitizeSegment(scope || "export", "export");
  const extPart = sanitizeSegment(extension || "csv", "csv");
  return `${filePart}_${pathPart}_${tabPart}_${scopePart}_${formatTimestamp()}.${extPart}`;
}

function createCsvBlob(rows = [], includeBom = true) {
  const lines = Array.isArray(rows) ? rows : [];
  const body = lines.join("\r\n");
  const content = includeBom ? `${CSV_BOM}${body}` : body;
  return new Blob([content], { type: "text/csv;charset=utf-8;" });
}

function triggerBlobDownload(blob, filename) {
  if (!(blob instanceof Blob)) {
    throw new Error("Invalid export blob.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "export.csv";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function appendQueryParam(searchParams, key, value) {
  if (value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (entry !== null && entry !== undefined && String(entry).trim() !== "") {
        searchParams.append(key, String(entry));
      }
    });
    return;
  }
  const text = String(value);
  if (text.trim() === "") {
    return;
  }
  searchParams.append(key, text);
}

function buildCsvExportUrl(fileKey, params = {}) {
  const endpoint = `/files/${encodeURIComponent(String(fileKey || ""))}/export/csv`;
  const url = new URL(endpoint, `${API_BASE_URL}/`);
  const searchParams = url.searchParams;
  Object.entries(params).forEach(([key, value]) => appendQueryParam(searchParams, key, value));
  return url.toString();
}

function triggerUrlDownload(url) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function copySvgComputedStyles(sourceSvg, clonedSvg) {
  const importantProps = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-opacity",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "letter-spacing",
    "text-anchor",
    "dominant-baseline",
  ];

  const sourceNodes = [sourceSvg, ...sourceSvg.querySelectorAll("*")];
  const clonedNodes = [clonedSvg, ...clonedSvg.querySelectorAll("*")];

  const count = Math.min(sourceNodes.length, clonedNodes.length);
  for (let index = 0; index < count; index += 1) {
    const sourceNode = sourceNodes[index];
    const clonedNode = clonedNodes[index];
    if (!sourceNode || !clonedNode) {
      continue;
    }
    const computed = window.getComputedStyle(sourceNode);
    const styleText = importantProps
      .map((property) => `${property}:${computed.getPropertyValue(property)};`)
      .join("");
    const existing = clonedNode.getAttribute("style") || "";
    clonedNode.setAttribute("style", `${existing}${styleText}`);
  }
}

async function svgElementToPngBlob(svgElement, options = {}) {
  if (!svgElement) {
    throw new Error("Line chart SVG not available for PNG export.");
  }

  const scale = Number.isFinite(Number(options.scale)) ? Math.max(1, Number(options.scale)) : 2;
  const background = String(options.background || "#FFFFFF");
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || Number(svgElement.getAttribute("width")) || 1024));
  const height = Math.max(
    1,
    Math.round(rect.height || Number(svgElement.getAttribute("height")) || 420)
  );

  const clonedSvg = svgElement.cloneNode(true);
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));
  clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  copySvgComputedStyles(svgElement, clonedSvg);

  const svgMarkup = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to rasterize line SVG."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("PNG export context unavailable.");
    }

    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to encode line PNG."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function canvasElementToPngBlob(canvasElement) {
  if (!canvasElement || typeof canvasElement.toBlob !== "function") {
    throw new Error("Heatmap canvas not available for PNG export.");
  }
  return new Promise((resolve, reject) => {
    canvasElement.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode heatmap PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export {
  buildCsvExportUrl,
  buildExportFilename,
  createCsvBlob,
  csvEscapeCell,
  svgElementToPngBlob,
  canvasElementToPngBlob,
  toCsvRow,
  triggerBlobDownload,
  triggerUrlDownload,
};
