/**
 * Formatting Utilities
 */

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format shape array to string
 */
export function formatShape(shape) {
  if (!shape || !Array.isArray(shape)) return '';
  return `(${shape.join(', ')})`;
}

/**
 * Format number with notation mode
 */
export function formatWithNotation(value, notation = 'auto') {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  
  if (notation === 'scientific') {
    return value.toExponential(6);
  } else if (notation === 'exact') {
    return String(value);
  } else {
    // Auto: use scientific for very large or very small numbers
    const abs = Math.abs(value);
    if (abs === 0) return '0';
    if (abs < 0.0001 || abs >= 1000000) {
      return value.toExponential(6);
    }
    return value.toString();
  }
}

/**
 * Format array of numbers
 */
export function formatArray(arr, notation = 'auto') {
  if (!Array.isArray(arr)) return String(arr);
  return arr.map(v => formatWithNotation(v, notation)).join(', ');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  return num.toLocaleString();
}

export default {
  formatBytes,
  formatShape,
  formatWithNotation,
  formatArray,
  truncate,
  formatNumber,
};
