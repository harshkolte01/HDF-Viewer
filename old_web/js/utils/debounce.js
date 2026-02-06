/**
 * Debounce and Throttle Utilities
 */

/**
 * Debounce function - delay execution until after wait milliseconds
 */
export function debounce(func, wait = 250) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - execute at most once per wait milliseconds
 */
export function throttle(func, wait = 16) {
  let lastTime = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func(...args);
    }
  };
}

export default {
  debounce,
  throttle,
};
