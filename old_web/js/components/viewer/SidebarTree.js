/**
 * SidebarTree Component
 * Lazy-loading tree navigation for HDF5 file structure
 */

import { Component } from '../Component.js';
import { getFileChildren } from '../../api/hdf5Service.js';

export class SidebarTree extends Component {
  constructor(container, props = {}) {
    super(container);
    
    this.props = {
      fileKey: '',
      selectedPath: '',
      onSelect: null,
      ...props
    };

    this.state = {
      treeRoot: null,
      expandedPaths: new Set(['/']),
      error: null,
    };

    this.render();

    if (this.props.fileKey) {
      this.loadRoot();
    }
  }

  updateProps(newProps) {
    const fileKeyChanged = newProps.fileKey !== this.props.fileKey;
    this.props = { ...this.props, ...newProps };
    
    if (fileKeyChanged && this.props.fileKey) {
      this.setState({
        treeRoot: null,
        expandedPaths: new Set(['/']),
        error: null,
      });
      this.loadRoot();
    } else {
      this.render();
    }
  }

  async loadRoot() {
    this.setState({
      treeRoot: {
        name: this.props.fileKey,
        path: '/',
        type: 'group',
        isRoot: true,
        isLoading: true,
        children: []
      }
    });

    try {
      const data = await getFileChildren(this.props.fileKey, '/');
      const root = {
        name: this.props.fileKey,
        path: '/',
        type: 'group',
        isRoot: true,
        isLoading: false,
        children: this.buildNodes(data.children)
      };
      this.setState({ treeRoot: root, error: null });
    } catch (err) {
      console.error('Error loading tree:', err);
      this.setState({
        error: err.message || 'Failed to load file structure',
        treeRoot: {
          ...this.state.treeRoot,
          isLoading: false,
          children: []
        }
      });
    }
  }

  buildNodes(children = []) {
    return children.map(child => ({
      name: child.name,
      path: child.path,
      type: child.type,
      numChildren: child.num_children || 0,
      isLoading: false,
      children: child.type === 'group' ? null : []
    }));
  }

  updateNodeByPath(node, path, updater) {
    if (!node) return node;
    if (node.path === path) {
      return updater(node);
    }

    if (!node.children) {
      return node;
    }

    return {
      ...node,
      children: node.children.map(child => 
        this.updateNodeByPath(child, path, updater)
      )
    };
  }

  async handleToggleExpand(e, node) {
    e.stopPropagation();

    if (node.type !== 'group') {
      return;
    }

    const expandedPaths = new Set(this.state.expandedPaths);
    const isExpanded = expandedPaths.has(node.path);

    if (isExpanded) {
      expandedPaths.delete(node.path);
      this.setState({ expandedPaths });
      return;
    }

    expandedPaths.add(node.path);
    this.setState({ expandedPaths });

    if (node.children === null) {
      const updatedRoot = this.updateNodeByPath(
        this.state.treeRoot,
        node.path,
        item => ({ ...item, isLoading: true })
      );
      this.setState({ treeRoot: updatedRoot });

      try {
        const data = await getFileChildren(this.props.fileKey, node.path);
        const finalRoot = this.updateNodeByPath(
          this.state.treeRoot,
          node.path,
          item => ({
            ...item,
            isLoading: false,
            children: this.buildNodes(data.children)
          })
        );
        this.setState({ treeRoot: finalRoot, error: null });
      } catch (err) {
        console.error('Error loading node:', err);
        const errorRoot = this.updateNodeByPath(
          this.state.treeRoot,
          node.path,
          item => ({ ...item, isLoading: false, children: [] })
        );
        this.setState({
          treeRoot: errorRoot,
          error: err.message || 'Failed to load children'
        });
      }
    }
  }

  handleSelectNode(node) {
    if (this.props.onSelect) {
      this.props.onSelect(node.path);
    }
  }

  renderNode(node) {
    const isGroup = node.type === 'group';
    const isExpanded = this.state.expandedPaths.has(node.path);
    const isActive = this.props.selectedPath === node.path;
    const hasChildren = isGroup && node.children && node.children.length > 0;

    let html = `
      <li class="tree-node" data-path="${node.path}">
        <button type="button" class="tree-row ${isActive ? 'active' : ''}" data-path="${node.path}">
          <span 
            class="tree-caret ${isGroup ? '' : 'is-leaf'} ${isExpanded ? 'is-open' : ''}"
            data-path="${node.path}"
            data-toggle="true"
          ></span>
          <span class="tree-icon ${isGroup ? 'is-group' : 'is-dataset'}"></span>
          <span class="tree-label">${node.name}</span>
          ${node.numChildren > 0 ? `<span class="tree-count">${node.numChildren}</span>` : ''}
        </button>
        ${node.isLoading ? '<div class="tree-status">Loading...</div>' : ''}
        ${isExpanded && hasChildren ? `
          <ul class="tree-branch">
            ${node.children.map(child => this.renderNode(child)).join('')}
          </ul>
        ` : ''}
      </li>
    `;

    return html;
  }

  render() {
    this.clearListeners();
    const { treeRoot, error } = this.state;

    if (error) {
      this.container.innerHTML = `
        <div class="tree-status error">${error}</div>
      `;
      return;
    }

    if (!treeRoot) {
      this.container.innerHTML = `
        <div class="tree-status">Loading tree...</div>
      `;
      return;
    }

    this.container.innerHTML = `
      <ul class="tree-root">
        ${this.renderNode(treeRoot)}
      </ul>
    `;

    // Event listeners
    this.on('click', '[data-toggle="true"]', (e, target) => {
      e.stopPropagation();
      const path = target.dataset.path;
      const node = this.findNodeByPath(this.state.treeRoot, path);
      if (node) {
        this.handleToggleExpand(e, node);
      }
    });

    this.on('click', '.tree-row', (e, target) => {
      const path = target.dataset.path;
      const node = this.findNodeByPath(this.state.treeRoot, path);
      if (node) {
        this.handleSelectNode(node);
      }
    });
  }

  findNodeByPath(node, path) {
    if (!node) return null;
    if (node.path === path) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeByPath(child, path);
        if (found) return found;
      }
    }
    
    return null;
  }
}

export default SidebarTree;
