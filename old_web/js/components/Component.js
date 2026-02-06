/**
 * Base Component Class
 * Provides common functionality for all components
 */

import { $ } from '../utils/dom.js';

export class Component {
  constructor(container) {
    this.container = container;
    this.state = {};
    this.listeners = [];
  }

  /**
   * Update state and trigger render
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  /**
   * Render method - must be implemented by subclasses
   */
  render() {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Query selector within container
   */
  $(selector) {
    return $(selector, this.container);
  }

  /**
   * Add event listener with delegation
   * Handler receives (event, target) - target is the matched element
   */
  on(event, selector, handler) {
    const listener = (e) => {
      const target = e.target.closest(selector);
      if (target && this.container.contains(target)) {
        handler(e, target);
      }
    };

    this.listen(this.container, event, listener);
  }

  /**
   * Direct event listener
   */
  addEventListener(event, handler, options) {
    this.listen(this.container, event, handler, options);
  }

  /**
   * Register and track listener on any target.
   */
  listen(target, event, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(event, handler, options);
    this.listeners.push({ target, event, listener: handler, options });
  }

  /**
   * Remove all delegated/direct listeners registered via this component.
   */
  clearListeners() {
    this.listeners.forEach(({ target, event, listener, options }) => {
      const removeTarget = target || this.container;
      removeTarget.removeEventListener(event, listener, options);
    });
    this.listeners = [];
  }

  /**
   * Cleanup - remove all event listeners
   */
  destroy() {
    this.clearListeners();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default Component;
