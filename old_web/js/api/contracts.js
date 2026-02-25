/**
 * @typedef {Object} FileItem
 * @property {string} key
 * @property {number} size
 * @property {string|null} last_modified
 * @property {string|null} etag
 */

/**
 * @typedef {Object} TreeNode
 * @property {string} type
 * @property {string} name
 * @property {string} path
 * @property {number=} num_children
 * @property {number[]=} shape
 * @property {string=} dtype
 * @property {number=} ndim
 * @property {number[]=} chunks
 * @property {string=} compression
 */

function asObject(value, fallback = {}) {
  return value && typeof value === "object" ? value : fallback;
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function asString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableString(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

function normalizeShape(value) {
  return asArray(value).map((entry) => asNumber(entry, 0));
}

/**
 * @param {any} value
 * @returns {FileItem}
 */
export function normalizeFileItem(value) {
  const raw = asObject(value);
  const key = asString(raw.key);
  const normalizedType = asString(raw.type, "").toLowerCase();
  const isFolder =
    raw.is_folder === true ||
    normalizedType === "folder" ||
    key.endsWith("/");

  return {
    key,
    size: asNumber(raw.size, 0),
    last_modified: asNullableString(raw.last_modified),
    etag: asNullableString(raw.etag),
    type: isFolder ? "folder" : "file",
    is_folder: isFolder,
  };
}

export function normalizeFilesResponse(payload) {
  const raw = asObject(payload);
  const files = asArray(raw.files).map(normalizeFileItem);
  const filesCount = files.filter((entry) => entry.type === "file").length;
  const foldersCount = files.filter((entry) => entry.type === "folder").length;

  return {
    success: raw.success === true,
    count: asNumber(raw.count, files.length),
    files,
    files_count: asNumber(raw.files_count, filesCount),
    folders_count: asNumber(raw.folders_count, foldersCount),
    truncated: raw.truncated === true,
    cached: raw.cached === true,
    error: raw.success === false ? asString(raw.error, "Unknown error") : null,
  };
}

/**
 * @param {any} value
 * @returns {TreeNode}
 */
export function normalizeTreeNode(value) {
  const raw = asObject(value);
  return {
    type: asString(raw.type, "unknown"),
    name: asString(raw.name),
    path: asString(raw.path),
    num_children: raw.num_children === undefined ? undefined : asNumber(raw.num_children, 0),
    shape: raw.shape === undefined ? undefined : normalizeShape(raw.shape),
    dtype: raw.dtype === undefined ? undefined : asString(raw.dtype),
    ndim: raw.ndim === undefined ? undefined : asNumber(raw.ndim, 0),
    chunks: raw.chunks === undefined ? undefined : normalizeShape(raw.chunks),
    compression: raw.compression === undefined ? undefined : asString(raw.compression),
  };
}

export function normalizeChildrenResponse(payload) {
  const raw = asObject(payload);
  return {
    success: raw.success === true,
    key: asString(raw.key),
    path: asString(raw.path, "/"),
    children: asArray(raw.children).map(normalizeTreeNode),
    cached: raw.cached === true,
    error: raw.success === false ? asString(raw.error, "Unknown error") : null,
  };
}

export function normalizeMetaResponse(payload) {
  const raw = asObject(payload);
  return {
    success: raw.success === true,
    key: asString(raw.key),
    metadata: asObject(raw.metadata),
    cached: raw.cached === true,
    error: raw.success === false ? asString(raw.error, "Unknown error") : null,
  };
}

export function normalizePreviewPayload(payload) {
  const raw = asObject(payload);
  return {
    success: raw.success === true,
    key: asString(raw.key),
    path: asString(raw.path),
    preview_type: asString(raw.preview_type, "unknown"),
    dtype: asString(raw.dtype),
    shape: normalizeShape(raw.shape),
    ndim: asNumber(raw.ndim, 0),
    display_dims: raw.display_dims === null ? null : normalizeShape(raw.display_dims),
    fixed_indices: asObject(raw.fixed_indices),
    mode: asString(raw.mode, "auto"),
    stats: asObject(raw.stats),
    table: asObject(raw.table),
    plot: asObject(raw.plot),
    profile: raw.profile === null ? null : asObject(raw.profile),
    limits: asObject(raw.limits),
    cached: raw.cached === true,
    error: raw.success === false ? asString(raw.error, "Unknown error") : null,
  };
}

function normalizeDataByMode(raw) {
  const mode = asString(raw.mode);

  if (mode === "matrix") {
    return {
      mode,
      data: asArray(raw.data),
      shape: normalizeShape(raw.shape),
      dtype: asString(raw.dtype),
      row_offset: asNumber(raw.row_offset, 0),
      col_offset: asNumber(raw.col_offset, 0),
      downsample_info: asObject(raw.downsample_info),
    };
  }

  if (mode === "heatmap") {
    return {
      mode,
      data: asArray(raw.data),
      shape: normalizeShape(raw.shape),
      dtype: asString(raw.dtype),
      stats: asObject(raw.stats),
      sampled: raw.sampled === true,
      downsample_info: asObject(raw.downsample_info),
      requested_max_size: asNumber(raw.requested_max_size, 0),
      effective_max_size: asNumber(raw.effective_max_size, 0),
      max_size_clamped: raw.max_size_clamped === true,
    };
  }

  if (mode === "line") {
    return {
      mode,
      data: asArray(raw.data),
      shape: normalizeShape(raw.shape),
      dtype: asString(raw.dtype),
      axis: asString(raw.axis),
      index: raw.index === null || raw.index === undefined ? null : asNumber(raw.index, 0),
      quality_requested: asString(raw.quality_requested, "auto"),
      quality_applied: asString(raw.quality_applied, "auto"),
      line_offset: asNumber(raw.line_offset, 0),
      line_limit: asNumber(raw.line_limit, 0),
      requested_points: asNumber(raw.requested_points, 0),
      returned_points: asNumber(raw.returned_points, 0),
      line_step: asNumber(raw.line_step, 1),
      downsample_info: asObject(raw.downsample_info),
    };
  }

  return {
    mode,
    data: asArray(raw.data),
    shape: normalizeShape(raw.shape),
    dtype: asString(raw.dtype),
  };
}

export function normalizeDataPayload(payload) {
  const raw = asObject(payload);
  const dataByMode = normalizeDataByMode(raw);

  return {
    success: raw.success === true,
    key: asString(raw.key),
    path: asString(raw.path),
    source_shape: normalizeShape(raw.source_shape),
    source_ndim: asNumber(raw.source_ndim, 0),
    display_dims: raw.display_dims === null ? null : normalizeShape(raw.display_dims),
    fixed_indices: asObject(raw.fixed_indices),
    error: raw.success === false ? asString(raw.error, "Unknown error") : null,
    ...dataByMode,
  };
}

export function assertSuccess(payload, operation) {
  if (!payload.success) {
    const message = payload.error || `${operation} failed`;
    throw new Error(message);
  }
  return payload;
}
