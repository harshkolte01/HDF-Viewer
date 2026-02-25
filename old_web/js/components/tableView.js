import { escapeHtml, formatBytes } from "../utils/format.js";

function isFolderEntry(file) {
  if (!file || typeof file !== "object") {
    return false;
  }
  if (file.is_folder === true) {
    return true;
  }
  if (String(file.type || "").toLowerCase() === "folder") {
    return true;
  }
  return String(file.key || "").endsWith("/");
}

export function renderFilesTable(files) {
  const rows = files
    .map((file, index) => {
      const isFolder = isFolderEntry(file);
      const entryType = isFolder ? "Folder" : "File";
      const actionCell = isFolder
        ? `<span class="entry-muted">--</span>`
        : `
            <button
              class="go-btn"
              data-open-file="${escapeHtml(file.key || "")}"
              data-open-etag="${escapeHtml(file.etag || "")}"
              type="button"
            >
              Open
            </button>
          `;
      return `
        <tr>
          <td class="sr-no">${index + 1}</td>
          <td class="file-name">${escapeHtml(file.key || "")}</td>
          <td class="file-type">${entryType}</td>
          <td class="file-size">${isFolder ? "--" : formatBytes(file.size)}</td>
          <td class="action-cell">
            ${actionCell}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="card">
      <div class="table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Object Key</th>
              <th>Type</th>
              <th>File Size</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
