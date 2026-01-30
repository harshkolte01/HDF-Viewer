# HDF Viewer Frontend Architecture

## Overview
The HDF Viewer frontend is a modern React application built with Vite, designed to provide an intuitive interface for browsing and visualizing HDF5 files stored in MinIO. The application features a professional dashboard UI with advanced data visualization capabilities.

## Technology Stack

### Core Technologies
- **React 19.2.0** - UI framework with latest features
- **Vite 7.2.4** - Build tool and development server
- **PropTypes** - Runtime type checking for React components

### Development Tools
- **ESLint** - Code linting and quality enforcement
- **@vitejs/plugin-react** - React Fast Refresh support

## Project Structure

```
frontend/
├── src/
│   ├── api/                 # API client and service layer
│   │   ├── client.js        # HTTP client with error handling
│   │   ├── config.js        # API endpoints and configuration
│   │   ├── hdf5Service.js   # HDF5-specific API methods
│   │   └── index.js         # Exports all API methods
│   ├── components/          # Reusable React components
│   │   └── viewer/          # Viewer-specific components
│   │       ├── PreviewToolbar.jsx
│   │       ├── SidebarTree.jsx
│   │       ├── TopBar.jsx
│   │       └── ViewerPanel.jsx
│   ├── pages/               # Page-level components
│   │   ├── HomePage.jsx     # File listing and selection
│   │   ├── ViewerPage.jsx   # HDF5 file viewer
│   │   └── ViewerPage.css   # Viewer-specific styles
│   ├── App.jsx              # Root component and routing logic
│   ├── App.css              # Global app styles
│   ├── index.css            # CSS variables and theme
│   └── main.jsx             # Application entry point
├── public/                  # Static assets
├── docs/                    # Documentation
├── .env                     # Environment variables
├── .env.example             # Environment template
├── vite.config.js           # Vite configuration
├── eslint.config.js         # ESLint configuration
└── package.json             # Dependencies and scripts
```

## Design System

### Color Palette
The application uses a professional blue-based color scheme:

#### Primary Colors
- **Background**: `#F8FAFF` - Light blue-tinted background
- **Surface/Cards**: `#FFFFFF` - Pure white for content areas
- **Surface Alt**: `#F2F6FF` - Alternative surface color
- **Border/Divider**: `#D9E2F2` - Subtle borders

#### Text Colors
- **Primary Text**: `#0F172A` - Dark slate for main content
- **Secondary Text**: `#475569` - Medium slate for labels

#### Brand Colors
- **Primary (Blue)**: `#2563EB` - Main action color
- **Primary Hover**: `#1D4ED8` - Darker blue for hover states
- **Accent (Sky)**: `#38BDF8` - Bright accent color

#### Status Colors
- **Success**: `#16A34A` with background `#ECFDF3`
- **Warning**: `#D97706` with background `#FFFBEB`
- **Error**: `#DC2626` with background `#FEF2F2`
- **Info**: `#0EA5E9` with background `#F0F9FF`

### Spacing & Layout
- Uses a consistent spacing scale (xs: 0.25rem to 2xl: 3rem)
- Border radius values from sm (0.375rem) to xl (1rem)
- Multiple shadow levels for depth hierarchy

## Application Architecture

### State Management
The application uses React's built-in state management:
- **useState** - Local component state
- **useEffect** - Side effects and data fetching
- **useMemo** - Performance optimization for computed values
- **useCallback** - Memoized callbacks for event handlers

No external state management library is used, keeping the architecture simple and lightweight.

### Routing Strategy
The app implements a simple state-based routing in `App.jsx`:
- **HomePage** - Displayed when no file is selected
- **ViewerPage** - Displayed when a file is selected
- Navigation is controlled via `selectedFile` state

### Data Flow

#### File Selection Flow
1. User views file list on **HomePage**
2. User clicks "Open" on a file
3. `onOpenFile(fileKey)` callback triggers
4. App state updates with `setSelectedFile(fileKey)`
5. **ViewerPage** renders with selected file

#### Viewer Data Flow
1. **ViewerPage** loads and displays file tree via **SidebarTree**
2. User selects a path in the tree
3. `selectedPath` state updates
4. Based on `viewMode`:
   - **Display mode**: Fetches preview data and renders visualizations
   - **Inspect mode**: Fetches metadata and displays attributes

## Core Components

### App.jsx
Root component that manages the top-level navigation state.

**State:**
- `selectedFile` - Currently selected HDF5 file key

**Behavior:**
- Renders HomePage when no file is selected
- Renders ViewerPage when a file is selected
- Provides callbacks for navigation

### HomePage.jsx
File browser and selection interface.

**Features:**
- Lists all HDF5 files from MinIO
- Search/filter functionality
- File statistics (count, total size)
- Refresh capability
- Loading and error states
- Professional card-based layout

**Key Functions:**
- `fetchFiles()` - Loads file list from API
- `handleRefresh()` - Triggers file cache refresh
- `formatFileSize()` - Human-readable file sizes
- `getTotalSize()` - Calculates total storage used

### ViewerPage.jsx
Main HDF5 file viewer with two modes: Display and Inspect.

**State Management:**
- `selectedPath` - Current path in HDF5 hierarchy
- `viewMode` - 'display' or 'inspect'
- `meta` - Metadata for inspect mode
- `preview` - Preview data for display mode
- `displayTab` - 'table', 'line', or 'heatmap'
- `displayDims` - Selected dimensions for display
- `fixedIndices` - Fixed indices for non-display dimensions
- `stagedDisplayDims` / `stagedFixedIndices` - Staging for dimension controls

**Display Modes:**
1. **Table View**: Renders dataset as a table with pagination
2. **Line Chart**: 1D or 2D data visualization with zoom/pan
3. **Heatmap**: 2D data visualization with color mapping

**Key Features:**
- Dimension selection for multi-dimensional data
- Staged dimension controls (apply/reset pattern)
- Scientific notation options
- Grid and aspect ratio controls
- Multiple color maps for heatmaps

### SidebarTree.jsx
Hierarchical file structure browser.

**Features:**
- Expandable/collapsible tree structure
- Lazy loading of child nodes
- Group and dataset icons
- Selected path highlighting
- Loading states for async operations

**State:**
- `treeRoot` - Root node of the tree
- `expandedPaths` - Set of expanded node paths

**Node Structure:**
```javascript
{
  name: string,
  path: string,
  type: 'group' | 'dataset',
  numChildren: number,
  isLoading: boolean,
  children: array | null
}
```

### ViewerPanel.jsx
Main content area that renders metadata or visualizations.

**Display Mode Features:**
- **DimensionControls**: UI for selecting display dimensions
- **TableView**: Paginated data table with scientific notation
- **LineChart**: SVG-based line chart with zoom/pan
- **Heatmap**: Canvas-based 2D heatmap visualization

**Inspect Mode Features:**
- Displays dataset/group metadata
- Shows attributes, shape, dtype, compression
- Formatted type descriptions

**Visualization Components:**

#### TableView
- Pagination support (configurable rows per page)
- Scientific notation formatting
- Responsive scrolling
- Alternating row colors

#### LineChart
- Interactive zoom (mouse wheel, buttons)
- Pan functionality (drag to move)
- Fullscreen mode
- Grid overlay toggle
- Hover tooltips with coordinates
- Aspect ratio options (line, point, both)
- Axis labels with scientific notation

#### Heatmap
- Canvas-based rendering for performance
- Multiple color maps (viridis, plasma, inferno, magma, cividis, grayscale)
- Grid overlay toggle
- Zoom and pan controls
- Color scale legend
- Interactive hover with value display

### PreviewToolbar.jsx
Visualization control toolbar.

**Features:**
- Tab switching (Table, Line, Heatmap)
- Export functionality placeholder
- Notation controls (auto, exact, scientific)
- Grid toggle for charts
- Aspect ratio selector for line charts
- Colormap selector for heatmaps

### TopBar.jsx
Application header with navigation and mode switching.

**Features:**
- Back button to return to file list
- File name display with breadcrumb
- Current path display
- Mode toggle (Display/Inspect)

## API Layer

### client.js
Core HTTP client with error handling.

**Features:**
- Centralized request function
- Automatic JSON parsing
- Custom `ApiError` class for error handling
- Network error handling
- HTTP method wrappers (GET, POST, PUT, DELETE)

### config.js
API configuration and endpoint definitions.

**Configuration:**
- `API_BASE_URL` - Backend server URL (from env variable)
- `API_ENDPOINTS` - Object containing all endpoint paths
- `buildUrl()` - Constructs full URLs with query parameters

**Endpoints:**
- `/health` - Health check
- `/files` - List all files
- `/files/refresh` - Refresh file cache
- `/files/:key/children` - Get HDF5 node children
- `/files/:key/meta` - Get metadata
- `/files/:key/preview` - Get data preview

### hdf5Service.js
HDF5-specific API service layer.

**Methods:**
- `getFiles()` - Fetch file list
- `refreshFiles()` - Trigger cache refresh
- `getFileChildren(key, path)` - Get children of HDF5 path
- `getFileMeta(key, path)` - Get metadata for path
- `getFilePreview(key, path, params)` - Get preview data
- `checkHealth()` - Server health check
- `runBenchmark()` - Performance benchmark

## Key Patterns and Conventions

### Component Patterns

#### Controlled Components
All form inputs and interactive elements are controlled:
```javascript
<input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

#### Conditional Rendering
Extensive use of conditional rendering for states:
```javascript
{loading && <LoadingSpinner />}
{error && <ErrorMessage />}
{data && <DataDisplay />}
```

#### Prop Validation
Uses PropTypes for runtime type checking:
```javascript
Component.propTypes = {
  fileKey: PropTypes.string.isRequired,
  onSelect: PropTypes.func
};
```

### Data Fetching Pattern
Consistent pattern across components:
1. Initialize loading state to true
2. Clear errors
3. Fetch data in try block
4. Update state with data
5. Catch errors and set error state
6. Always set loading to false in finally block

### Staging Pattern
Used for dimension controls to allow preview before applying:
1. Maintain both "current" and "staged" state
2. User modifies staged state
3. Preview shows staged changes
4. "Apply" button commits staged to current
5. "Reset" button reverts staged to defaults

### Error Handling
- All API calls wrapped in try-catch
- User-friendly error messages
- Error states display with retry options
- Console logging for debugging

### Performance Optimizations

#### Memoization
- `useMemo` for expensive computations
- `useCallback` for stable function references
- Prevents unnecessary re-renders

#### Lazy Loading
- Tree nodes load children on demand
- Reduces initial load time
- Better performance for large files

#### Efficient Rendering
- Canvas for heatmap (better than SVG for dense data)
- SVG for line charts (better for interactive elements)
- Pagination for large tables

## Environment Configuration

### .env Variables
```
VITE_API_BASE_URL=http://localhost:5000
```

The application uses Vite's environment variable system with `import.meta.env`.

## Build and Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Development Server
- Vite dev server with Hot Module Replacement (HMR)
- Fast refresh for React components
- Runs on default port 5173

### Production Build
- Optimized bundle with code splitting
- Minification and tree-shaking
- Outputs to `dist/` directory

## User Experience Features

### Visual Feedback
- Loading spinners during data fetches
- Disabled buttons during operations
- Hover states on interactive elements
- Active states for selected items

### Error Handling
- Graceful error messages
- Retry mechanisms
- Empty states with helpful messages
- Network error handling

### Responsive Design
- Flexible layouts
- Scrollable containers
- Fullscreen mode for charts
- Professional spacing and alignment

## Future Enhancement Opportunities

### Potential Improvements
1. **TypeScript Migration** - Add static type checking
2. **Testing** - Add unit and integration tests
3. **Accessibility** - ARIA labels and keyboard navigation
4. **Internationalization** - Multi-language support
5. **Progressive Web App** - Offline capability
6. **Advanced Visualizations** - 3D plots, more chart types
7. **Data Export** - Download data in various formats
8. **User Preferences** - Persistent settings
9. **Performance Monitoring** - Analytics integration
10. **Dark Mode** - Theme switching

## Debugging

### Development Mode
The application includes debug logging in development mode:
- Preview request/response logging
- Dimension control change logging
- Tree loading logs

Enable via:
```javascript
const DEBUG = import.meta.env.DEV;
```

### Browser DevTools
- React DevTools for component inspection
- Network tab for API monitoring
- Console for application logs
- Performance profiler for optimization

## Best Practices Followed

1. **Single Responsibility** - Each component has one clear purpose
2. **DRY Principle** - Reusable components and utilities
3. **Separation of Concerns** - API layer separate from UI
4. **Consistent Naming** - Clear, descriptive names
5. **Error Boundaries** - Graceful error handling
6. **Loading States** - Always show feedback during async operations
7. **Prop Types** - Runtime type checking
8. **CSS Organization** - Component-specific styles with global theme
9. **Code Comments** - Documented complex logic
10. **Clean Code** - Readable, maintainable structure
