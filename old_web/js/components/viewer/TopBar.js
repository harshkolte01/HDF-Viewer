/**
 * TopBar Component
 * Displays breadcrumb navigation and view mode toggle
 */

import { Component } from '../Component.js';
import { navigateToHome } from '../../router.js';

export class TopBar extends Component {
  constructor(container, props = {}) {
    super(container);
    
    this.props = {
      fileKey: '',
      selectedPath: '',
      viewMode: 'display',
      onModeChange: null,
      ...props
    };

    this.render();
  }

  updateProps(newProps) {
    this.props = { ...this.props, ...newProps };
    this.render();
  }

  handleBackClick() {
    navigateToHome();
  }

  handleModeClick(mode) {
    if (this.props.onModeChange) {
      this.props.onModeChange(mode);
    }
  }

  getPathSegments() {
    const { selectedPath } = this.props;
    if (!selectedPath) return [];
    return selectedPath.split('/').filter(Boolean);
  }

  render() {
    this.clearListeners();
    const { fileKey, viewMode } = this.props;
    const segments = this.getPathSegments();

    this.container.innerHTML = `
      <div class="viewer-topbar">
        <div class="topbar-left">
          <div class="breadcrumb-label">File location</div>
          <div class="breadcrumb">
            <span class="crumb">${fileKey || 'Unknown'}</span>
            ${segments.length === 0 ? '<span class="crumb active">root</span>' : ''}
            ${segments.map((segment, index) => {
              const isLast = index === segments.length - 1;
              return `<span class="crumb ${isLast ? 'active' : ''}">${segment}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="topbar-right">
          <button class="ghost-btn back-btn" type="button">
            Back to files
          </button>
          <div class="segmented">
            <button 
              class="seg-btn ${viewMode === 'display' ? 'active' : ''}" 
              type="button"
              data-mode="display"
            >
              Display
            </button>
            <button 
              class="seg-btn ${viewMode === 'inspect' ? 'active' : ''}" 
              type="button"
              data-mode="inspect"
            >
              Inspect
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    this.on('click', '.back-btn', () => this.handleBackClick());
    this.on('click', '.seg-btn', (e, target) => {
      const mode = target.dataset.mode;
      if (mode) this.handleModeClick(mode);
    });
  }
}

export default TopBar;
