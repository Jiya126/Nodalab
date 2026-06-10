import { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { Play, AlertCircle, CheckCircle, X } from 'lucide-react';

interface ExecutionResult {
  success: boolean;
  output_shape: number[] | null;
  error: string | null;
}

interface Props {
  onClose: () => void;
}

export default function ExecutionPanel({ onClose }: Props) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const nodes = useGraphStore(s => s.nodes);
  const edges = useGraphStore(s => s.edges);
  const projectName = useGraphStore(s => s.projectName);
  const projectId = useGraphStore(s => s.projectId);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);

    const payload = {
      id: projectId,
      name: projectName,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.blockType,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? null,
        target: e.target,
        targetHandle: e.targetHandle ?? null,
      })),
    };

    try {
      const response = await fetch('/api/execute/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        output_shape: null,
        error: 'Could not connect to backend. Make sure the server is running on port 8000.',
      });
    }

    setIsRunning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[500px] rounded-xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Play size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Run Model (Dummy Forward Pass)
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sends the graph to the backend, builds the PyTorch model, runs a dummy forward pass
            with random data, and returns the output shape. This verifies your architecture is valid.
          </p>

          <button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: isRunning ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: 'white',
              opacity: nodes.length === 0 ? 0.5 : 1,
            }}
          >
            {isRunning ? 'Running...' : 'Run Forward Pass'}
          </button>

          {result && (
            <div
              className="p-4 rounded-lg text-xs"
              style={{
                background: result.success ? '#22c55e10' : '#ef444410',
                border: `1px solid ${result.success ? '#22c55e30' : '#ef444430'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: result.success ? 'var(--success)' : 'var(--error)' }}>
                {result.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <span className="font-semibold">{result.success ? 'Success' : 'Error'}</span>
              </div>

              {result.success && result.output_shape && (
                <div className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  Output shape: [{result.output_shape.join(', ')}]
                </div>
              )}

              {result.error && (
                <div style={{ color: 'var(--error)' }}>{result.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
