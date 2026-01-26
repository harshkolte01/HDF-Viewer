import { useEffect, useMemo, useState } from 'react';
import { getFileChildren } from '../../api';

const buildNodes = (children = []) =>
  children.map((child) => ({
    name: child.name,
    path: child.path,
    type: child.type,
    numChildren: child.num_children || 0,
    meta: child,
    isLoading: false,
    children: child.type === 'group' ? null : []
  }));

const updateNodeByPath = (node, path, updater) => {
  if (!node) return node;
  if (node.path === path) {
    return updater(node);
  }

  if (!node.children) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) => updateNodeByPath(child, path, updater))
  };
};

function SidebarTree({ fileKey, selectedPath, onSelect }) {
  const [treeRoot, setTreeRoot] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState(new Set(['/']));
  const [treeError, setTreeError] = useState(null);

  useEffect(() => {
    if (!fileKey) return;
    setExpandedPaths(new Set(['/']));
    setTreeError(null);
    setTreeRoot({
      name: fileKey,
      path: '/',
      type: 'group',
      isRoot: true,
      isLoading: true,
      children: []
    });

    const loadRoot = async () => {
      try {
        const data = await getFileChildren(fileKey, '/');
        setTreeError(null);
        setTreeRoot((current) =>
          updateNodeByPath(current, '/', (node) => ({
            ...node,
            isLoading: false,
            children: buildNodes(data.children)
          }))
        );
      } catch (err) {
        console.error('Error loading tree:', err);
        setTreeError(err.message || 'Failed to load file structure');
        setTreeRoot((current) =>
          updateNodeByPath(current, '/', (node) => ({
            ...node,
            isLoading: false,
            children: []
          }))
        );
      }
    };

    loadRoot();
  }, [fileKey]);

  const handleToggleExpand = async (e, node) => {
    e.stopPropagation(); // Prevent row click

    if (node.type !== 'group') {
      return;
    }

    const nextExpanded = new Set(expandedPaths);
    const isExpanded = expandedPaths.has(node.path);

    if (isExpanded) {
      nextExpanded.delete(node.path);
      setExpandedPaths(nextExpanded);
      return;
    }

    nextExpanded.add(node.path);
    setExpandedPaths(nextExpanded);

    if (node.children === null) {
      setTreeRoot((current) =>
        updateNodeByPath(current, node.path, (item) => ({
          ...item,
          isLoading: true
        }))
      );

      try {
        const data = await getFileChildren(fileKey, node.path);
        setTreeError(null);
        setTreeRoot((current) =>
          updateNodeByPath(current, node.path, (item) => ({
            ...item,
            isLoading: false,
            children: buildNodes(data.children)
          }))
        );
      } catch (err) {
        console.error('Error loading node:', err);
        setTreeError(err.message || 'Failed to load children');
        setTreeRoot((current) =>
          updateNodeByPath(current, node.path, (item) => ({
            ...item,
            isLoading: false,
            children: []
          }))
        );
      }
    }
  };

  const handleSelectNode = (node) => {
    if (onSelect) {
      onSelect(node.path);
    }
  };

  const renderNode = (node) => {
    const isGroup = node.type === 'group';
    const isExpanded = expandedPaths.has(node.path);
    const isActive = selectedPath === node.path;
    const hasChildren = isGroup && node.children && node.children.length > 0;

    return (
      <li key={node.path} className="tree-node">
        <button
          type="button"
          className={`tree-row ${isActive ? 'active' : ''}`}
          onClick={() => handleSelectNode(node)}
        >
          <span
            className={`tree-caret ${isGroup ? '' : 'is-leaf'} ${isExpanded ? 'is-open' : ''
              }`}
            onClick={(e) => handleToggleExpand(e, node)}
            aria-hidden="true"
          ></span>
          <span
            className={`tree-icon ${isGroup ? 'is-group' : 'is-dataset'}`}
            aria-hidden="true"
          ></span>
          <span className="tree-label">{node.name}</span>
          {isGroup && node.numChildren > 0 && (
            <span className="tree-count">{node.numChildren}</span>
          )}
        </button>
        {isGroup && isExpanded && (
          <ul className="tree-branch">
            {node.isLoading && (
              <li className="tree-status">Loading...</li>
            )}
            {hasChildren && node.children.map((child) => renderNode(child))}
            {!node.isLoading && node.children && node.children.length === 0 && (
              <li className="tree-status">No items</li>
            )}
          </ul>
        )}
      </li>
    );
  };

  const sidebarTitle = useMemo(() => {
    if (!fileKey) return 'HDF Viewer';
    return fileKey;
  }, [fileKey]);

  return (
    <aside className="viewer-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-title">{sidebarTitle}</div>
        {fileKey && <div className="file-pill">Active file</div>}
      </div>

      <div className="sidebar-section">
        <div className="section-label">Structure</div>
        <ul className="tree-root">
          {treeError && <li className="tree-status error">{treeError}</li>}
          {treeRoot ? renderNode(treeRoot) : (
            <li className="tree-status">Select a file</li>
          )}
        </ul>
      </div>
    </aside>
  );
}

export default SidebarTree;
