import { templates } from '../engine/templates';
import { useGraphStore } from '../store/graphStore';
import { X, Layout } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function TemplateSelector({ onClose }: Props) {
  const nodes = useGraphStore(s => s.nodes);
  const clearGraph = useGraphStore(s => s.clearGraph);

  const handleSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (nodes.length > 0) {
      clearGraph();
    }

    const { nodes: newNodes, edges: newEdges } = template.build();
    useGraphStore.setState({
      nodes: newNodes,
      edges: newEdges,
      projectName: template.name,
    });
    useGraphStore.getState().recalculate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[600px] max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Layout size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Start from Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid gap-3">
          <button
            onClick={() => {
              if (nodes.length > 0) clearGraph();
              onClose();
            }}
            className="text-left p-4 rounded-lg border transition-colors hover:border-indigo-500/50"
            style={{
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Start from Scratch
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Empty canvas. Drag blocks from the library to build your architecture.
            </div>
          </button>

          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className="text-left p-4 rounded-lg border transition-colors hover:border-indigo-500/50"
              style={{
                background: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {t.name}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
