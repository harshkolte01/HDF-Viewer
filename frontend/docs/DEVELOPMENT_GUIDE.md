# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ (recommended: 20.x)
- npm 9+ or yarn 1.22+
- Backend API running (default: http://localhost:5000)

### Installation

1. Clone the repository and navigate to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```

Edit `.env` to set your API URL:
```
VITE_API_BASE_URL=http://localhost:5000
```

4. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

---

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

Features:
- Hot Module Replacement (HMR)
- Fast refresh for React components
- Instant feedback on code changes
- Source maps for debugging

### Building for Production

```bash
npm run build
```

Output directory: `dist/`

Features:
- Optimized bundle with minification
- Tree-shaking for smaller bundle size
- Code splitting for lazy loading
- Source maps for production debugging

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing.

### Linting

```bash
npm run lint
```

Runs ESLint to check code quality and style.

---

## Project Structure Deep Dive

### Directory Organization

```
frontend/
├── public/                 # Static assets served as-is
│   └── (place images, icons, etc.)
├── src/
│   ├── api/               # API client layer
│   │   ├── client.js      # HTTP client
│   │   ├── config.js      # API configuration
│   │   ├── hdf5Service.js # HDF5 API methods
│   │   └── index.js       # Exports
│   ├── components/        # React components
│   │   └── viewer/        # Viewer-specific components
│   ├── pages/             # Page components
│   ├── assets/            # Images, icons
│   ├── App.jsx            # Root component
│   ├── App.css            # Global app styles
│   ├── index.css          # CSS variables and theme
│   └── main.jsx           # Entry point
├── docs/                  # Documentation
├── .env                   # Environment variables (git-ignored)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── eslint.config.js       # ESLint configuration
├── index.html             # HTML template
├── package.json           # Dependencies and scripts
├── package-lock.json      # Locked dependency versions
├── README.md              # Basic project info
└── vite.config.js         # Vite configuration
```

### File Naming Conventions

- **Components**: PascalCase with `.jsx` extension
  - `HomePage.jsx`, `ViewerPanel.jsx`
- **Styles**: Match component name with `.css`
  - `ViewerPage.css`, `ViewerPanel.css`
- **Utilities**: camelCase with `.js` extension
  - `hdf5Service.js`, `client.js`
- **Constants**: UPPER_SNAKE_CASE
  - `API_ENDPOINTS`, `DEFAULT_FETCH_OPTIONS`

---

## Code Style Guide

### React Component Structure

```javascript
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './ComponentName.css';

// Utility functions (outside component)
const helperFunction = (value) => {
  return value.toString();
};

function ComponentName({ prop1, prop2, onAction }) {
  // State declarations
  const [state1, setState1] = useState(initialValue);
  const [state2, setState2] = useState(initialValue);

  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // Event handlers
  const handleClick = () => {
    // Handler logic
  };

  // Render helpers
  const renderSection = () => {
    return <div>Content</div>;
  };

  // Main render
  return (
    <div className="component-name">
      {/* JSX content */}
    </div>
  );
}

// PropTypes validation
ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number,
  onAction: PropTypes.func
};

export default ComponentName;
```

### State Management

#### Local State
Use `useState` for component-specific state:
```javascript
const [count, setCount] = useState(0);
const [user, setUser] = useState(null);
```

#### Computed Values
Use `useMemo` for expensive computations:
```javascript
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.price, 0);
}, [items]);
```

#### Callbacks
Use `useCallback` for stable function references:
```javascript
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### API Calls

#### Standard Pattern
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getData();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [dependency]);
```

#### With Parameters
```javascript
useEffect(() => {
  if (!requiredParam) {
    setData(null);
    return;
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getData(requiredParam, {
        option1: value1,
        option2: value2
      });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [requiredParam, value1, value2]);
```

### Error Handling

#### API Errors
```javascript
try {
  const result = await api.call();
  // Success handling
} catch (err) {
  if (err instanceof ApiError) {
    // Handle API errors
    console.error('API Error:', err.status, err.message);
    setError(`Failed: ${err.message}`);
  } else {
    // Handle network errors
    console.error('Network Error:', err);
    setError('Network error occurred');
  }
}
```

#### User-Friendly Messages
```javascript
const getErrorMessage = (err) => {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'Resource not found';
    if (err.status === 500) return 'Server error occurred';
    return err.message;
  }
  return 'An unexpected error occurred';
};
```

### Conditional Rendering

#### Loading States
```javascript
{loading && (
  <div className="loading-state">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
)}
```

#### Error States
```javascript
{error && (
  <div className="error-state">
    <div className="error-message">{error}</div>
    <button onClick={retry}>Try Again</button>
  </div>
)}
```

#### Empty States
```javascript
{!loading && !error && data.length === 0 && (
  <div className="empty-state">
    <p>No data available</p>
  </div>
)}
```

#### Content
```javascript
{!loading && !error && data && (
  <div className="content">
    {/* Render data */}
  </div>
)}
```

---

## Styling Guidelines

### CSS Organization

#### Theme Variables
Define in `index.css`:
```css
:root {
  --primary: #2563EB;
  --spacing-md: 1rem;
  --radius-md: 0.5rem;
}
```

Use in components:
```css
.button {
  background: var(--primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}
```

#### Component Styles
Each component has its own CSS file:
```css
/* ComponentName.css */
.component-name {
  /* Base styles */
}

.component-name__element {
  /* Element styles */
}

.component-name--modifier {
  /* Modifier styles */
}

.component-name.is-active {
  /* State styles */
}
```

#### State Classes
Use `.is-` prefix for state:
- `.is-active`
- `.is-loading`
- `.is-disabled`
- `.is-expanded`
- `.is-selected`

### Responsive Design

#### Flexible Layouts
```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

@media (min-width: 768px) {
  .container {
    flex-direction: row;
  }
}
```

#### Scrollable Containers
```css
.scrollable {
  overflow: auto;
  max-height: 500px;
}
```

---

## Adding New Features

### Creating a New Component

1. Create component file:
```bash
touch src/components/NewComponent.jsx
touch src/components/NewComponent.css
```

2. Implement component:
```javascript
import { useState } from 'react';
import PropTypes from 'prop-types';
import './NewComponent.css';

function NewComponent({ prop1 }) {
  const [state, setState] = useState(null);

  return (
    <div className="new-component">
      {/* Content */}
    </div>
  );
}

NewComponent.propTypes = {
  prop1: PropTypes.string.isRequired
};

export default NewComponent;
```

3. Add styles:
```css
.new-component {
  /* Styles */
}
```

4. Use component:
```javascript
import NewComponent from './components/NewComponent';

<NewComponent prop1="value" />
```

### Adding a New API Endpoint

1. Add endpoint to `config.js`:
```javascript
export const API_ENDPOINTS = {
  // ...existing endpoints
  NEW_ENDPOINT: (param) => `/api/resource/${param}`
};
```

2. Add service method in `hdf5Service.js`:
```javascript
export const newApiMethod = async (param) => {
  const endpoint = API_ENDPOINTS.NEW_ENDPOINT(param);
  return await get(endpoint, { option: value });
};
```

3. Export from `index.js`:
```javascript
export { newApiMethod } from './hdf5Service';
```

4. Use in component:
```javascript
import { newApiMethod } from '../api';

const result = await newApiMethod(param);
```

### Adding a New Visualization

1. Create visualization component in `ViewerPanel.jsx`:
```javascript
function NewVisualization({ data, options }) {
  return (
    <div className="new-visualization">
      {/* Visualization logic */}
    </div>
  );
}
```

2. Add tab option in `PreviewToolbar.jsx`:
```javascript
<button
  className={`tab-button ${activeTab === 'newviz' ? 'active' : ''}`}
  onClick={() => onTabChange('newviz')}
>
  New Viz
</button>
```

3. Add rendering logic in `ViewerPanel.jsx`:
```javascript
{activeTab === 'newviz' && preview && (
  <NewVisualization data={preview.data} options={options} />
)}
```

---

## Debugging

### Development Tools

#### React DevTools
- Install browser extension
- Inspect component tree
- View props and state
- Profile performance

#### Browser DevTools
- **Console**: View logs and errors
- **Network**: Monitor API calls
- **Elements**: Inspect DOM and styles
- **Sources**: Debug with breakpoints
- **Performance**: Profile render performance

### Debug Logging

Enable debug mode in ViewerPage:
```javascript
const DEBUG = import.meta.env.DEV;

const logPreview = (...args) => {
  if (!DEBUG) return;
  console.info('[preview]', ...args);
};
```

Add custom logging:
```javascript
if (import.meta.env.DEV) {
  console.log('Debug info:', data);
}
```

### Common Issues

#### API Connection Failed
- Check backend is running
- Verify `VITE_API_BASE_URL` in `.env`
- Check CORS settings on backend
- Inspect network tab for errors

#### Hot Reload Not Working
- Restart dev server
- Clear browser cache
- Check for syntax errors
- Verify file is saved

#### Component Not Re-rendering
- Check dependency arrays in useEffect
- Verify state updates are immutable
- Use React DevTools to inspect state
- Check for console errors

---

## Testing

### Manual Testing Checklist

#### HomePage
- [ ] Files load correctly
- [ ] Search filters work
- [ ] Refresh button works
- [ ] Statistics display correctly
- [ ] Open button navigates to viewer
- [ ] Empty state shows when no files
- [ ] Error state shows on failure
- [ ] Loading state shows during fetch

#### ViewerPage
- [ ] Tree loads and displays structure
- [ ] Tree nodes expand/collapse
- [ ] Datasets can be selected
- [ ] Display mode shows data correctly
- [ ] Inspect mode shows metadata
- [ ] Tab switching works
- [ ] Dimension controls function
- [ ] Apply/Reset buttons work

#### Visualizations
- [ ] Table pagination works
- [ ] Line chart zooms and pans
- [ ] Heatmap renders correctly
- [ ] Fullscreen mode works
- [ ] Grid toggle works
- [ ] Colormap changes apply
- [ ] Hover tooltips display

### Unit Testing (Future)

Framework recommendation: **Vitest** + **React Testing Library**

Install:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Example test:
```javascript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders file list', () => {
    render(<HomePage onOpenFile={() => {}} />);
    expect(screen.getByText('Files')).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### Optimization Techniques

#### Memoization
```javascript
// Expensive computation
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Stable callback
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

#### Code Splitting
```javascript
// Lazy load components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

#### Virtualization
For large lists, use virtualization:
```javascript
// Install react-window
npm install react-window

import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={50}
>
  {Row}
</FixedSizeList>
```

#### Canvas for Heavy Rendering
Use Canvas API for large visualizations:
```javascript
useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  // Draw on canvas
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}, [data]);
```

### Bundle Size Optimization

#### Analyze Bundle
```bash
npm run build -- --mode analyze
```

#### Import Only What You Need
```javascript
// Bad
import _ from 'lodash';

// Good
import { debounce } from 'lodash-es';
```

---

## Deployment

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Environment Variables

Production `.env`:
```
VITE_API_BASE_URL=https://api.production.com
```

### Deployment Options

#### Static Hosting (Netlify, Vercel)
1. Connect repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in dashboard

#### Traditional Server (Nginx)
```nginx
server {
  listen 80;
  server_name example.com;
  root /path/to/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

#### Docker
```dockerfile
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Troubleshooting

### Build Issues

#### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Type Errors
```bash
# Check for missing PropTypes
npm install prop-types
```

### Runtime Issues

#### Blank Page
- Check browser console for errors
- Verify API_BASE_URL is set correctly
- Check network tab for failed requests
- Ensure backend is accessible

#### Styles Not Loading
- Check CSS import paths
- Clear browser cache
- Verify CSS variables are defined
- Check for CSS syntax errors

#### API Errors
- Verify backend is running
- Check CORS configuration
- Inspect request/response in network tab
- Verify API endpoint URLs

---

## Best Practices

### Code Quality
1. **Use PropTypes** for type checking
2. **Handle all states**: loading, error, empty, success
3. **Clean up effects**: return cleanup functions
4. **Avoid inline functions** in JSX (use useCallback)
5. **Extract complex logic** into custom hooks
6. **Keep components small** and focused
7. **Use meaningful names** for variables and functions
8. **Comment complex logic** but avoid obvious comments
9. **Use constants** for magic numbers and strings
10. **Follow existing patterns** in the codebase

### Performance
1. **Memoize expensive computations** with useMemo
2. **Memoize callbacks** with useCallback
3. **Avoid unnecessary re-renders**
4. **Use keys properly** in lists
5. **Lazy load** heavy components
6. **Optimize images** and assets
7. **Use pagination** for large datasets
8. **Debounce** search and filter inputs
9. **Use Canvas** for complex visualizations
10. **Profile** before optimizing

### Security
1. **Sanitize user input**
2. **Validate data** from API
3. **Use HTTPS** in production
4. **Avoid storing secrets** in frontend
5. **Implement CSRF protection** if needed
6. **Keep dependencies** up to date
7. **Use environment variables** for config
8. **Validate file uploads** if implemented
9. **Handle errors gracefully**
10. **Log errors** for monitoring

---

## Resources

### Official Documentation
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [MDN Web Docs](https://developer.mozilla.org)

### Tools
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [ESLint](https://eslint.org)
- [Prettier](https://prettier.io)

### Learning
- [React Beta Docs](https://react.dev)
- [JavaScript Info](https://javascript.info)
- [CSS Tricks](https://css-tricks.com)

---

## Getting Help

### Internal Resources
- Check `docs/` folder for architecture and component guides
- Review existing components for patterns
- Check git history for context on changes

### External Resources
- React documentation
- Stack Overflow
- GitHub Issues for dependencies
- Developer community forums

### Debugging Process
1. Check browser console for errors
2. Inspect network tab for API issues
3. Use React DevTools to inspect components
4. Add debug logging
5. Isolate the problem
6. Search for similar issues
7. Ask for help with specific error messages
