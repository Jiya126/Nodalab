import { useEffect, useCallback, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import TopBar from './components/TopBar';
import BlockLibrary from './components/BlockLibrary';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import CodePreview from './components/CodePreview';
import CustomBlockEditor from './components/CustomBlockEditor';
import StatusBar from './components/StatusBar';
import TemplateSelector from './components/TemplateSelector';
import TrainingConfig from './components/TrainingConfig';
import ExecutionPanel from './components/ExecutionPanel';
import { useGraphStore } from './store/graphStore';
import { useUIStore } from './store/uiStore';
import { decodeGraphFromURL } from './engine/sharing';

export default function App() {
  const showBlockLibrary = useUIStore(s => s.showBlockLibrary);
  const showCodePreview = useUIStore(s => s.showCodePreview);
  const showPropertiesPanel = useUIStore(s => s.showPropertiesPanel);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const [showExecution, setShowExecution] = useState(false);

  const deleteSelected = useGraphStore(s => s.deleteSelected);
  const duplicateSelected = useGraphStore(s => s.duplicateSelected);
  const undo = useGraphStore(s => s.undo);
  const redo = useGraphStore(s => s.redo);
  const saveToLocalStorage = useGraphStore(s => s.saveToLocalStorage);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const graphParam = params.get('graph');
    if (graphParam) {
      const decoded = decodeGraphFromURL(graphParam);
      if (decoded) {
        useGraphStore.setState({
          projectName: decoded.projectName,
          nodes: decoded.nodes,
          edges: decoded.edges,
        });
        useGraphStore.getState().recalculate();
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveToLocalStorage();
      }
    },
    [deleteSelected, duplicateSelected, undo, redo, saveToLocalStorage]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ReactFlowProvider>
      <div className="w-full h-full flex flex-col">
        <TopBar
          onOpenTemplates={() => setShowTemplates(true)}
          onOpenTraining={() => setShowTraining(true)}
          onRunModel={() => setShowExecution(true)}
        />
        <div className="flex flex-1 overflow-hidden">
          {showBlockLibrary && <BlockLibrary />}

          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex-1 min-h-0">
              <Canvas />
            </div>
            {showCodePreview && (
              <div className="h-64 shrink-0">
                <CodePreview />
              </div>
            )}
          </div>

          {showPropertiesPanel && (
            <div className="flex flex-col" style={{ width: 320 }}>
              <div className="flex-1 overflow-hidden">
                <PropertiesPanel />
              </div>
              <CustomBlockEditor />
            </div>
          )}
        </div>
        <StatusBar />
      </div>

      {showTemplates && (
        <TemplateSelector onClose={() => setShowTemplates(false)} />
      )}
      {showTraining && (
        <TrainingConfig onClose={() => setShowTraining(false)} />
      )}
      {showExecution && (
        <ExecutionPanel onClose={() => setShowExecution(false)} />
      )}
    </ReactFlowProvider>
  );
}
