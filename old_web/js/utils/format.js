export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatBytes(bytes) {
  const safeBytes = Number(bytes) || 0;
  if (safeBytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.floor(Math.log(safeBytes) / Math.log(1024));
  const normalizedIndex = Math.min(unitIndex, units.length - 1);

  return `${(safeBytes / 1024 ** normalizedIndex).toFixed(2)} ${units[normalizedIndex]}`;
}
