# HDF5 Viewer - Vanilla JS Version

A pure vanilla JavaScript implementation of the HDF5 file viewer, providing full feature parity with the React version.

## 🚀 Quick Start

### Prerequisites
- Python 3.x or Node.js (for local server)
- Backend server running on `http://localhost:5000`

### Running the Application

**Option 1: Python**
```bash
cd old_web
python -m http.server 5500
```

**Option 2: Node.js (npx)**
```bash
cd old_web
npx serve -p 5500
```

Then open `http://localhost:5500` in your browser.

**⚠️ Important:** Do NOT open `index.html` directly via `file://` protocol. ES modules require a web server.

## 📁 Project Structure

```
old_web/
├── index.html              # HomePage entry
├── viewer.html             # ViewerPage entry
├── css/                    # Stylesheets
│   ├── reset.css
│   ├── theme.css
│   ├── common.css
│   ├── home.css
│   ├── viewer.css
│   └── viewer-panel.css
├── js/
│   ├── main.js            # App initialization
│   ├── router.js          # Navigation
│   ├── api/               # API layer
│   │   ├── client.js
│   │   ├── config.js
│   │   └── hdf5Service.js
│   ├── utils/             # Utilities
│   │   ├── dom.js
│   │   ├── formatters.js
│   │   ├── debounce.js
│   │   └── cache.js
│   ├── components/        # UI Components
│   │   ├── Component.js
│   │   ├── HomePage.js    # ✅ Implemented
│   │   ├── ViewerPage.js  # ⏳ To implement
│   │   └── viewer/
│   │       ├── SidebarTree.js      # ⏳ To implement
│   │       ├── TopBar.js           # ⏳ To implement
│   │       ├── PreviewToolbar.js   # ⏳ To implement
│   │       └── ViewerPanel.js      # ⏳ To implement
│   └── visualizations/    # Data visualizations
│       ├── VirtualMatrix.js  # ⏳ To implement
│       ├── LineChart.js      # ⏳ To implement
│       └── Heatmap.js        # ⏳ To implement
└── docs/
    └── IMPLEMENTATION_PROGRESS.md
```

## ✅ Completed (Phase 1-2)

- ✅ Project structure and HTML shells
- ✅ Complete CSS styling (all 6 files)
- ✅ API layer with proper error handling
- ✅ Utility modules (DOM, formatters, debounce, cache)
- ✅ Base Component class with lifecycle
- ✅ Router for navigation
- ✅ HomePage with file browsing, search, and refresh

## 🎯 Current Status

**Working Features:**
- File list display with stats
- Search filtering
- Refresh files cache
- Responsive design
- Error handling

**To Implement (Phases 3-7):**
- Viewer page components
- Tree navigation with lazy loading
- Multi-dimensional data controls
- Three visualization modes (Matrix, Line, Heatmap)
- Virtual scrolling
- Zoom/pan interactions

## 🏗️ Architecture

### Component Pattern

All components extend the base `Component` class:

```javascript
import { Component } from './Component.js';

class MyComponent extends Component {
  constructor(container) {
    super(container);
    this.state = { /* initial state */ };
  }

  render() {
    this.container.innerHTML = `<!-- HTML -->`;
  }

  destroy() {
    super.destroy(); // Cleanup
  }
}
```

### State Management

- Component-local state via `this.state`
- Updates via `this.setState({ key: value })`
- Auto-re-renders on state change

### Event Handling

```javascript
// Event delegation
this.on('click', '.button-class', this.handleClick.bind(this));

// Direct listener
this.addEventListener('input', this.handleInput.bind(this));
```

All listeners automatically cleaned up in `destroy()`.

## 🔧 API Service

Matches React version exactly:

```javascript
import { getFiles, refreshFiles, getFileChildren, getFileMeta, 
         getFilePreview, getFileData } from './api/hdf5Service.js';

// Example usage
const response = await getFiles();
const children = await getFileChildren('test.h5', '/group1');
const preview = await getFilePreview('test.h5', '/dataset1', { 
  display_dims: '0,1', 
  fixed_indices: '2=5' 
});
```

## 🎨 Styling

Uses CSS custom properties from [css/theme.css](css/theme.css):

```css
var(--bg-primary)       /* #F8FAFF */
var(--surface)          /* #FFFFFF */
var(--primary)          /* #2563EB */
var(--accent)           /* #38BDF8 */
var(--text-primary)     /* #0F172A */
var(--text-secondary)   /* #475569 */
/* ... and more */
```

## 📋 Next Implementation Steps

### Phase 3: Viewer Infrastructure

**1. TopBar.js**
- Breadcrumb navigation
- Display/Inspect mode toggle
- Back to home button

**2. SidebarTree.js**
- Lazy-loading tree structure
- Expand/collapse nodes
- Active path highlighting
- Group vs dataset icons

**3. PreviewToolbar.js**
- Tab navigation (table, line, heatmap)
- Notation controls
- Grid/aspect/colormap toggles

### Phase 4: ViewerPage Orchestrator

**ViewerPage.js** - Main state manager:
- 13+ state variables
- Handles all data fetching
- Coordinates child components
- Caching and request management

State structure:
```javascript
{
  selectedPath, viewMode,
  meta, metaLoading, metaError,
  preview, previewLoading, previewError,
  displayTab, notation, lineGrid, lineAspect,
  heatmapGrid, heatmapColormap,
  displayDims, fixedIndices,
  stagedDisplayDims, stagedFixedIndices,
  // + matrix/line/heatmap full data states
}
```

### Phase 5: ViewerPanel Display

**ViewerPanel.js** - Content renderer:
- Metadata display (inspect mode)
- Dimension controls with staging
- Preview table rendering
- Coordinates visualizations

### Phase 6: Visualizations

**1. VirtualMatrix.js**
- Constants: `ROW_HEIGHT=28`, `COL_WIDTH=96`, `HEADER_HEIGHT=28`, `INDEX_WIDTH=60`, `OVERSCAN=4`
- Block-based loading (200×50 blocks)
- Scroll-based viewport management
- Cache integration

**2. LineChart.js**
- SVG chart rendering
- Zoom/pan with transforms
- Hover tooltips
- Fullscreen mode
- Debounced range refetch

**3. Heatmap.js**
- SVG cell grid
- Colormap functions (viridis, plasma, etc.)
- Zoom/pan interactions
- High-res mode (max_size=1024)
- Clamp info display when `max_size_clamped=true`

### Phase 7: Integration

- Wire all components in main.js
- Add keyboard shortcuts
- Performance optimization
- Cross-browser testing

## 🧪 Testing

1. **HomePage:** Search, refresh, file opening
2. **Navigation:** URL params, back/forward buttons
3. **Error Handling:** Network failures, invalid data
4. **Performance:** Large file lists, virtual scrolling
5. **Browsers:** Chrome, Firefox, Safari, Edge

## 📖 Useful References

- **Plan:** [../docs/plan-vanillaJsHdfViewer.prompt.md](../docs/plan-vanillaJsHdfViewer.prompt.md)
- **Progress:** [docs/IMPLEMENTATION_PROGRESS.md](docs/IMPLEMENTATION_PROGRESS.md)
- **React Version:** [../frontend/src/](../frontend/src/)

## 🐛 Debugging Tips

1. **Module errors:** Ensure running via web server, not `file://`
2. **API errors:** Check backend is running on port 5000
3. **CORS issues:** Backend must allow `localhost:5500`
4. **CSS not loading:** Check file paths are relative
5. **State not updating:** Ensure calling `this.setState()`, not direct mutation

## 🔗 Browser DevTools

- **Network tab:** Monitor API calls
- **Console:** Check for errors
- **Sources:** Set breakpoints in JS
- **Elements:** Inspect DOM and CSS

## 📝 Code Style

- ES6+ features (classes, arrow functions, async/await)
- ES modules (import/export)
- Consistent naming (camelCase for functions/variables)
- Comments for complex logic
- Keep components focused and single-purpose

## 🚦 Performance Guidelines

- Debounce user inputs (250ms)
- Throttle scroll events (16ms)
- Use `DocumentFragment` for batch DOM updates
- Cache DOM queries where possible
- Clean up listeners in `destroy()`

## 📦 No Build Step

- No bundler required
- No transpilation needed
- Just serve and go!
- Perfect for learning and small projects

## 🎓 Learning Resources

This implementation demonstrates:
- Modern vanilla JS patterns
- Component-based architecture
- State management without frameworks
- ES modules in browser
- Custom API client
- Virtual scrolling
- SVG visualizations with interactions

---

**Status:** Foundation complete (Phases 1-2). Ready for Viewer implementation (Phases 3-7).

For detailed implementation plan, see [../docs/plan-vanillaJsHdfViewer.prompt.md](../docs/plan-vanillaJsHdfViewer.prompt.md).
