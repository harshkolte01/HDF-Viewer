# Component Guide

## Overview
This document provides detailed information about each component in the HDF Viewer frontend, including props, state, methods, and usage examples.

## Table of Contents
- [App Component](#app-component)
- [Pages](#pages)
  - [HomePage](#homepage)
  - [ViewerPage](#viewerpage)
- [Viewer Components](#viewer-components)
  - [TopBar](#topbar)
  - [SidebarTree](#sidebartree)
  - [PreviewToolbar](#previewtoolbar)
  - [ViewerPanel](#viewerpanel)

---

## App Component

**File:** `src/App.jsx`

### Purpose
Root component that manages top-level navigation between the file list and viewer.

### State
| Name | Type | Description |
|------|------|-------------|
| `selectedFile` | `string \| null` | Currently selected file key, null shows HomePage |

### Methods
| Name | Parameters | Description |
|------|------------|-------------|
| `handleOpenFile` | `fileKey: string` | Opens viewer for specified file |
| `handleBackToFiles` | none | Returns to file list view |

### Render Logic
```javascript
if (!selectedFile) {
  return <HomePage onOpenFile={handleOpenFile} />;
}
return <ViewerPage fileKey={selectedFile} onBack={handleBackToFiles} />;
```

### Usage
```javascript
<App />
```

---

## Pages

### HomePage

**File:** `src/pages/HomePage.jsx`

### Purpose
Main landing page that displays list of HDF5 files available in MinIO storage.

### Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `onOpenFile` | `function` | Yes | Callback when user opens a file |

### State
| Name | Type | Description |
|------|------|-------------|
| `files` | `array` | List of file objects from API |
| `loading` | `boolean` | Initial load state |
| `error` | `string \| null` | Error message if load fails |
| `refreshing` | `boolean` | True during refresh operation |
| `searchQuery` | `string` | Current search filter text |

### Methods

#### `fetchFiles()`
Loads file list from API.
- Sets loading state
- Clears errors
- Updates files array
- Handles errors with user-friendly messages

#### `handleRefresh()`
Triggers file cache refresh and reloads list.
- Calls `/files/refresh` endpoint
- Re-fetches file list
- Shows refreshing state
- Handles errors

#### `formatFileSize(bytes)`
Converts bytes to human-readable format.
- Returns formatted string (B, KB, MB, GB, TB)
- Handles zero bytes
- Uses 1024 as base

#### `getTotalSize()`
Calculates total size of all files.
- Sums all file sizes
- Returns formatted string

### Features
- **Search/Filter**: Real-time filtering by filename
- **Statistics**: Shows total files, total size, and filtered count
- **Refresh**: Manual refresh button with visual feedback
- **Empty States**: Helpful messages when no files exist
- **Error Handling**: Retry button on errors
- **Loading States**: Spinner during initial load

### UI Structure
```
Navbar
  - Logo and title
  - Refresh button
Main Content
  - Page header
  - Statistics cards (Total Files, Total Size, Showing)
  - Search box
  - Files table
    - Columns: #, File Name, File Size, Action
    - Open button for each file
```

### Usage
```javascript
<HomePage onOpenFile={(fileKey) => console.log(fileKey)} />
```

---

### ViewerPage

**File:** `src/pages/ViewerPage.jsx`

### Purpose
Main HDF5 file viewer with hierarchical navigation and data visualization.

### Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | Yes | HDF5 file identifier |
| `onBack` | `function` | Yes | Callback to return to file list |

### State

#### Core State
| Name | Type | Description |
|------|------|-------------|
| `selectedPath` | `string` | Current path in HDF5 hierarchy |
| `viewMode` | `string` | 'display' or 'inspect' |

#### Metadata State (Inspect Mode)
| Name | Type | Description |
|------|------|-------------|
| `meta` | `object \| null` | Metadata for selected path |
| `metaLoading` | `boolean` | Loading state for metadata |
| `metaError` | `string \| null` | Error message |

#### Preview State (Display Mode)
| Name | Type | Description |
|------|------|-------------|
| `preview` | `object \| null` | Preview data for selected path |
| `previewLoading` | `boolean` | Loading state for preview |
| `previewError` | `string \| null` | Error message |

#### Display Controls
| Name | Type | Description |
|------|------|-------------|
| `displayTab` | `string` | Active tab: 'table', 'line', 'heatmap' |
| `displayDims` | `array \| null` | Selected dimensions [row, col] |
| `fixedIndices` | `object` | Fixed indices for other dimensions |
| `stagedDisplayDims` | `array \| null` | Staged dimension selection |
| `stagedFixedIndices` | `object` | Staged fixed indices |

#### Visualization Settings
| Name | Type | Description |
|------|------|-------------|
| `notation` | `string` | Number format: 'auto', 'exact', 'scientific' |
| `lineGrid` | `boolean` | Show grid on line chart |
| `lineAspect` | `string` | Line chart mode: 'line', 'point', 'both' |
| `heatmapGrid` | `boolean` | Show grid on heatmap |
| `heatmapColormap` | `string` | Heatmap color scheme |

### Methods

#### `handleStagedDisplayDimsChange(nextDims, shape)`
Updates staged dimension selection.
- Validates dimensions
- Clears fixed indices for display dimensions
- Sets default fixed indices for non-display dimensions

#### `handleStagedFixedIndexChange(dim, value, size)`
Updates a staged fixed index value.
- Clamps value to valid range [0, size-1]

#### `handleApplyDimensions()`
Applies staged dimension changes to active state.
- Triggers preview re-fetch

#### `handleResetDimensions()`
Resets dimensions to defaults based on preview data.
- Uses default display_dims from API
- Sets middle value for fixed indices

### Effects

#### File Change Effect
Resets selectedPath to '/' when fileKey changes.

#### Path Change Effect
Resets display settings when selectedPath changes:
- Display tab to 'table'
- Display dimensions to null
- Fixed indices to empty
- Clears staged values
- Resets visualization settings

#### Metadata Fetch Effect
Fetches metadata when in inspect mode.
- Only fetches for non-root paths
- Handles loading and error states

#### Preview Fetch Effect
Fetches preview data when in display mode.
- Constructs query parameters from dimension settings
- Handles loading and error states
- Syncs display dimensions and fixed indices with response

### Computed Values
| Name | Description |
|------|-------------|
| `showHeatmap` | True if preview has 2+ dimensions |
| `displayDimsKey` | Comma-separated display dimensions |
| `fixedIndicesKey` | Formatted fixed indices string |

### UI Structure
```
ViewerPage
  ├── SidebarTree (left panel)
  │   - Hierarchical file structure
  │   - Expandable groups
  │   - Select datasets/groups
  └── Main Section (right panel)
      ├── TopBar
      │   - Back button
      │   - File/path breadcrumb
      │   - Mode toggle
      ├── PreviewToolbar (display mode only)
      │   - Tab selector
      │   - Visualization controls
      └── ViewerPanel
          - Content based on mode and tab
```

### Usage
```javascript
<ViewerPage 
  fileKey="example.h5" 
  onBack={() => console.log('back')} 
/>
```

---

## Viewer Components

### TopBar

**File:** `src/components/viewer/TopBar.jsx`

### Purpose
Header bar with navigation and mode controls.

### Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | Yes | Current file name |
| `selectedPath` | `string` | Yes | Current HDF5 path |
| `viewMode` | `string` | Yes | Current mode |
| `onModeChange` | `function` | Yes | Mode change callback |
| `onBack` | `function` | Yes | Back button callback |

### Features
- **Back Button**: Returns to file list
- **File Name**: Displays current file
- **Path Display**: Shows selected path in hierarchy
- **Mode Toggle**: Switches between Display and Inspect modes
- **Active States**: Highlights current mode

### UI Elements
```
[← Back] FileKey > Selected Path      [Display] [Inspect]
```

---

### SidebarTree

**File:** `src/components/viewer/SidebarTree.jsx`

### Purpose
Hierarchical tree view of HDF5 file structure with lazy loading.

### Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileKey` | `string` | Yes | HDF5 file identifier |
| `selectedPath` | `string` | Yes | Currently selected path |
| `onSelect` | `function` | Yes | Path selection callback |

### State
| Name | Type | Description |
|------|------|-------------|
| `treeRoot` | `object \| null` | Root node of tree |
| `expandedPaths` | `Set` | Set of expanded node paths |
| `treeError` | `string \| null` | Error message if load fails |

### Node Structure
```javascript
{
  name: string,           // Node name
  path: string,           // Full HDF5 path
  type: 'group' | 'dataset',
  numChildren: number,    // Child count
  isRoot: boolean,        // Root node flag
  isLoading: boolean,     // Loading state
  children: array | null  // null = not loaded yet
}
```

### Methods

#### `buildNodes(children)`
Converts API response to node structure.

#### `updateNodeByPath(node, path, updater)`
Recursively updates a node in the tree.
- Immutable update pattern
- Returns new tree structure

#### `handleToggleExpand(e, node)`
Handles node expansion/collapse.
- Stops event propagation
- Toggles expanded state
- Lazy loads children if needed
- Updates loading state

#### `handleNodeClick(node)`
Handles node selection.
- Calls onSelect callback
- Updates selected path

### Features
- **Lazy Loading**: Children loaded on first expand
- **Visual Icons**: Different icons for groups and datasets
- **Expand/Collapse**: Click arrow to toggle
- **Selection**: Click node to select
- **Loading States**: Spinner during async operations
- **Error Handling**: Shows error messages
- **Indentation**: Visual depth indication

### Usage
```javascript
<SidebarTree
  fileKey="data.h5"
  selectedPath="/group1/dataset1"
  onSelect={(path) => console.log(path)}
/>
```

---

### PreviewToolbar

**File:** `src/components/viewer/PreviewToolbar.jsx`

### Purpose
Control toolbar for visualization settings and tab switching.

### Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `activeTab` | `string` | Yes | Current tab: 'table', 'line', 'heatmap' |
| `onTabChange` | `function` | Yes | Tab change callback |
| `showHeatmap` | `boolean` | Yes | Whether to show heatmap tab |
| `onExport` | `function` | Yes | Export callback (placeholder) |
| `disabled` | `boolean` | No | Disable all controls |
| `notation` | `string` | Yes | Number notation setting |
| `onNotationChange` | `function` | Yes | Notation change callback |
| `lineGrid` | `boolean` | Yes | Line chart grid state |
| `onLineGridChange` | `function` | Yes | Line grid change callback |
| `lineAspect` | `string` | Yes | Line aspect ratio |
| `onLineAspectChange` | `function` | Yes | Aspect change callback |
| `heatmapGrid` | `boolean` | Yes | Heatmap grid state |
| `onHeatmapGridChange` | `function` | Yes | Heatmap grid change callback |
| `heatmapColormap` | `string` | Yes | Heatmap colormap |
| `onHeatmapColormapChange` | `function` | Yes | Colormap change callback |

### Features

#### Tab Controls
- **Table**: Always available
- **Line**: Available for any dataset
- **Heatmap**: Only for 2D+ datasets

#### Table Controls
- **Notation**: Auto, Exact, Scientific

#### Line Chart Controls
- **Notation**: Auto, Exact, Scientific
- **Grid**: Toggle grid overlay
- **Aspect**: Line, Point, or Both

#### Heatmap Controls
- **Grid**: Toggle grid overlay
- **Colormap**: viridis, plasma, inferno, magma, cividis, grayscale

### UI Layout
```
[Table] [Line] [Heatmap]    [Export]    [Notation] [Grid] [Aspect/Colormap]
```

---

### ViewerPanel

**File:** `src/components/viewer/ViewerPanel.jsx`

### Purpose
Main content area that renders different views based on mode and tab.

### Props

#### Core Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selectedPath` | `string` | Yes | Current HDF5 path |
| `viewMode` | `string` | Yes | 'display' or 'inspect' |

#### Inspect Mode Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `meta` | `object \| null` | Yes | Metadata object |
| `loading` | `boolean` | Yes | Loading state |
| `error` | `string \| null` | Yes | Error message |

#### Display Mode Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `preview` | `object \| null` | Yes | Preview data object |
| `previewLoading` | `boolean` | Yes | Loading state |
| `previewError` | `string \| null` | Yes | Error message |
| `activeTab` | `string` | Yes | Active visualization tab |

#### Dimension Control Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `displayDims` | `array \| null` | Yes | Current display dimensions |
| `fixedIndices` | `object` | Yes | Current fixed indices |
| `stagedDisplayDims` | `array \| null` | Yes | Staged dimensions |
| `stagedFixedIndices` | `object` | Yes | Staged indices |
| `onDisplayDimsChange` | `function` | Yes | Dimension change callback |
| `onFixedIndexChange` | `function` | Yes | Fixed index change callback |
| `onApplyDimensions` | `function` | Yes | Apply button callback |
| `onResetDimensions` | `function` | Yes | Reset button callback |

#### Visualization Props
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `notation` | `string` | Yes | Number notation |
| `lineGrid` | `boolean` | Yes | Line grid state |
| `lineAspect` | `string` | Yes | Line aspect mode |
| `heatmapGrid` | `boolean` | Yes | Heatmap grid state |
| `heatmapColormap` | `string` | Yes | Heatmap colormap |

### Sub-Components

#### DimensionControls
Interactive controls for selecting display dimensions and fixing others.

**Features:**
- Dropdown for X and Y dimension selection
- Sliders for fixed dimensions
- Current index display
- Apply and Reset buttons
- Staged changes preview

#### TableView
Paginated data table with formatting.

**Features:**
- Pagination controls
- Rows per page selector (10, 25, 50, 100)
- Scientific notation support
- Row and column headers
- Scrollable container

#### LineChart
Interactive SVG-based line chart.

**Features:**
- Zoom controls (wheel, buttons)
- Pan functionality (drag)
- Fullscreen mode
- Grid overlay
- Axis labels with smart formatting
- Hover tooltip with coordinates
- Multiple aspect modes
- Zoom percentage display
- Reset view button

#### Heatmap
Canvas-based 2D heatmap visualization.

**Features:**
- Canvas rendering for performance
- Multiple color maps
- Grid overlay
- Zoom and pan controls
- Color scale legend
- Hover value display
- Min/max value labels
- Fullscreen mode

### Metadata Display (Inspect Mode)
Shows detailed information about selected item:
- **Type**: Dataset or Group
- **Attributes**: Key-value pairs
- **Dataset Info**: Shape, dtype, compression, chunks
- **Type Details**: Formatted type description

### Empty States
- Root path message
- No data available
- Loading spinners
- Error messages

### Usage
```javascript
<ViewerPanel
  selectedPath="/data"
  viewMode="display"
  preview={previewData}
  previewLoading={false}
  previewError={null}
  activeTab="table"
  displayDims={[0, 1]}
  fixedIndices={{2: 5}}
  // ... other props
/>
```

---

## Utility Functions

### formatValue(value)
Formats any value for display.
- Arrays: joins with ' x '
- null/undefined: returns '--'
- Objects: JSON.stringify
- Others: String conversion

### formatNumber(value, notation)
Formats numbers based on notation setting.
- **auto**: Scientific for very large/small, locale otherwise
- **exact**: String representation
- **scientific**: Exponential notation

### formatAxisNumber(value)
Formats numbers for axis labels.
- Rounds integers
- Formats decimals with max 4 digits

### formatCell(value, notation)
Formats table cell values.
- Handles arrays recursively
- Applies notation to numbers
- Parses string numbers

### formatTypeDescription(typeInfo)
Formats HDF5 type information.
- Combines class, signedness, size, endianness
- Returns readable description

### normalizeNumber(value)
Converts value to number, returns 0 if invalid.

---

## State Management Patterns

### Loading Pattern
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await api.getData();
    setData(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Staging Pattern
```javascript
const [current, setCurrent] = useState(initialValue);
const [staged, setStaged] = useState(initialValue);

const handleChange = (newValue) => {
  setStaged(newValue);
};

const handleApply = () => {
  setCurrent(staged);
};

const handleReset = () => {
  setStaged(defaultValue);
};
```

### Tree Update Pattern
```javascript
const updateNodeByPath = (node, path, updater) => {
  if (node.path === path) {
    return updater(node);
  }
  return {
    ...node,
    children: node.children?.map(child => 
      updateNodeByPath(child, path, updater)
    )
  };
};
```

---

## Styling Guidelines

### Component-Specific Styles
Each component has its own CSS file:
- `ViewerPage.css` - Viewer layout and styles
- `ViewerPanel.css` - Panel and visualization styles
- `App.css` - Global app styles

### Theme Variables
All colors, spacing, and shadows use CSS variables defined in `index.css`.

### Class Naming
- BEM-inspired naming: `component-element--modifier`
- Descriptive class names
- State classes: `is-active`, `is-loading`, `is-disabled`

### Responsive Approach
- Flexible containers
- Scrollable areas
- Percentage-based widths
- Max-width constraints

---

## Testing Considerations

### Component Testing
Each component should be tested for:
1. Rendering with required props
2. User interactions (clicks, inputs)
3. State changes
4. Error states
5. Loading states
6. Edge cases (empty data, invalid props)

### Integration Testing
Test component interactions:
1. Navigation flow (HomePage → ViewerPage)
2. Tree expansion and selection
3. Tab switching
4. Dimension controls
5. API integration

### Accessibility Testing
Ensure:
1. Keyboard navigation
2. Screen reader compatibility
3. Focus management
4. ARIA labels
5. Color contrast
