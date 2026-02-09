import { escapeHtml, formatBytes } from "../utils/format.js";

export function renderFilesTable(files) {
  const rows = files
    .map(
      (file, index) => `
        <tr>
          <td class="sr-no">${index + 1}</td>
          <td class="file-name">${escapeHtml(file.key || "")}</td>
          <td class="file-size">${formatBytes(file.size)}</td>
          <td class="action-cell">
            <button
              class="go-btn"
              data-open-file="${escapeHtml(file.key || "")}"
              data-open-etag="${escapeHtml(file.etag || "")}"
              type="button"
            >
              Open
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="card">
      <div class="table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th>#</th>
              <th>File Name</th>
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
