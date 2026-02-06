/**
 * DOM Manipulation Helpers
 */

/**
 * Create an element with optional className and attributes
 */
export function createElement(tag, className = '', attrs = {}) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  Object.entries(attrs).forEach(([key,value]) => {
    if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  });
  return el;
}

/**
 * Set text content safely
 */
export function setText(el, text) {
  el.textContent = text;
}

/**
 * Add class to element
 */
export function addClass(el, className) {
  el.classList.add(className);
}

/**
 * Remove class from element
 */
export function removeClass(el, className) {
  el.classList.remove(className);
}

/**
 * Toggle class on element
 */
export function toggleClass(el, className, force) {
  if (force !== undefined) {
    el.classList.toggle(className, force);
  } else {
    el.classList.toggle(className);
  }
}

/**
 * Check if element has class
 */
export function hasClass(el, className) {
  return el.classList.contains(className);
}

/**
 * Empty element (remove all children)
 */
export function empty(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Remove element from DOM
 */
export function remove(el) {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/**
 * Query selector within element
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query selector all within element
 */
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Set attributes
 */
export function setAttrs(el, attrs) {
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

/**
 * Create SVG element
 */
export function createSVGElement(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

export default {
  createElement,
  setText,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  empty,
  remove,
  $,
  $$,
  setAttrs,
  createSVGElement,
};
