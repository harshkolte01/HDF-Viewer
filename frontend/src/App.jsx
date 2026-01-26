import { useState } from 'react';
import HomePage from './pages/HomePage';
import ViewerPage from './pages/ViewerPage';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleOpenFile = (fileKey) => {
    setSelectedFile(fileKey);
  };

  const handleBackToFiles = () => {
    setSelectedFile(null);
  };

  if (!selectedFile) {
    return <HomePage onOpenFile={handleOpenFile} />;
  }

  return <ViewerPage fileKey={selectedFile} onBack={handleBackToFiles} />;
}

export default App;
