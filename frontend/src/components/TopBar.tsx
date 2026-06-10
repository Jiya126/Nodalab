import { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useUIStore } from '../store/uiStore';
import { encodeGraphToURL } from '../engine/sharing';
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  Undo2,
  Redo2,
  PanelLeft,
  PanelRight,
  Code,
  Layout,
  Settings,
  Play,
  Share2,
  Check,
} from 'lucide-react';
import { useRef } from 'react';

interface TopBarProps {
  onOpenTemplates: () => void;
  onOpenTraining: () => void;
  onRunModel: () => void;
}

export default function TopBar({ onOpenTemplates, onOpenTraining, onRunModel }: TopBarProps) {
  const projectName = useGraphStore(s => s.projectName);
  const setProjectName = useGraphStore(s => s.setProjectName);
  const saveToLocalStorage = useGraphStore(s => s.saveToLocalStorage);
  const loadFromLocalStorage = useGraphStore(s => s.loadFromLocalStorage);
  const exportToJSON = useGraphStore(s => s.exportToJSON);
  const importFromJSON = useGraphStore(s => s.importFromJSON);
  const clearGraph = useGraphStore(s => s.clearGraph);
  const undo = useGraphStore(s => s.undo);
  const redo = useGraphStore(s => s.redo);
  const nodes = useGraphStore(s => s.nodes);
  const edges = useGraphStore(s => s.edges);

  const toggleBlockLibrary = useUIStore(s => s.toggleBlockLibrary);
  const toggleCodePreview = useUIStore(s => s.toggleCodePreview);
  const togglePropertiesPanel = useUIStore(s => s.togglePropertiesPanel);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const handleExportJSON = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.nodalab.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importFromJSON(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleShare = async () => {
    const url = encodeGraphToURL(projectName, nodes, edges);
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div
      className="h-11 flex items-center px-3 gap-2 shrink-0"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
          N
        </div>
        <input
          type="text"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          className="bg-transparent text-sm font-semibold outline-none border-none w-40"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      <div className="h-5 w-px mx-1" style={{ background: 'var(--border-color)' }} />

      <ToolButton icon={<Undo2 size={14} />} label="Undo (Ctrl+Z)" onClick={undo} />
      <ToolButton icon={<Redo2 size={14} />} label="Redo (Ctrl+Shift+Z)" onClick={redo} />

      <div className="h-5 w-px mx-1" style={{ background: 'var(--border-color)' }} />

      <ToolButton icon={<Save size={14} />} label="Save (Ctrl+S)" onClick={() => saveToLocalStorage()} />
      <ToolButton icon={<FolderOpen size={14} />} label="Load" onClick={() => loadFromLocalStorage()} />
      <ToolButton icon={<Download size={14} />} label="Export JSON" onClick={handleExportJSON} />
      <ToolButton
        icon={<Upload size={14} />}
        label="Import JSON"
        onClick={() => fileInputRef.current?.click()}
      />

      <div className="h-5 w-px mx-1" style={{ background: 'var(--border-color)' }} />

      <ToolButton icon={<Layout size={14} />} label="Templates" onClick={onOpenTemplates} />
      <ToolButton icon={<Settings size={14} />} label="Training Config" onClick={onOpenTraining} />
      <ToolButton icon={<Play size={14} />} label="Run Model" onClick={onRunModel} />
      <ToolButton
        icon={shareCopied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
        label={shareCopied ? 'Link copied!' : 'Share via URL'}
        onClick={handleShare}
      />
      <ToolButton icon={<Trash2 size={14} />} label="Clear Canvas" onClick={clearGraph} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        className="hidden"
      />

      <div className="flex-1" />

      <ToolButton icon={<PanelLeft size={14} />} label="Toggle Block Library" onClick={toggleBlockLibrary} />
      <ToolButton icon={<Code size={14} />} label="Toggle Code Preview" onClick={toggleCodePreview} />
      <ToolButton icon={<PanelRight size={14} />} label="Toggle Properties" onClick={togglePropertiesPanel} />
    </div>
  );
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="p-1.5 rounded hover:bg-white/10 transition-colors"
      style={{ color: 'var(--text-muted)' }}
    >
      {icon}
    </button>
  );
}
