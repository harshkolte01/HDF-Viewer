import { useEffect, useState } from 'react';
import { getFileMeta } from '../api';
import SidebarTree from '../components/viewer/SidebarTree';
import TopBar from '../components/viewer/TopBar';
import ViewerPanel from '../components/viewer/ViewerPanel';
import './ViewerPage.css';

function ViewerPage({ fileKey, onBack }) {
  const [selectedPath, setSelectedPath] = useState('/');
  const [viewMode, setViewMode] = useState('display');
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState(null);

  useEffect(() => {
    setSelectedPath('/');
  }, [fileKey]);

  useEffect(() => {
    const fetchMeta = async () => {
      if (!fileKey || !selectedPath || viewMode !== 'inspect') {
        setMeta(null);
        setMetaError(null);
        setMetaLoading(false);
        return;
      }
      if (selectedPath === '/') {
        setMeta(null);
        setMetaError(null);
        setMetaLoading(false);
        return;
      }
      try {
        setMetaLoading(true);
        setMetaError(null);
        const data = await getFileMeta(fileKey, selectedPath);
        setMeta(data.metadata || null);
      } catch (err) {
        setMetaError(err.message || 'Failed to load metadata');
        setMeta(null);
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMeta();
  }, [fileKey, selectedPath, viewMode]);

  return (
    <div className="viewer-page">
      <SidebarTree
        fileKey={fileKey}
        selectedPath={selectedPath}
        onSelect={setSelectedPath}
      />
      <section className="viewer-main">
        <TopBar
          fileKey={fileKey}
          selectedPath={selectedPath}
          viewMode={viewMode}
          onModeChange={setViewMode}
          onBack={onBack}
        />
        <ViewerPanel
          fileKey={fileKey}
          selectedPath={selectedPath}
          viewMode={viewMode}
          meta={meta}
          loading={metaLoading}
          error={metaError}
        />
      </section>
    </div>
  );
}

export default ViewerPage;
