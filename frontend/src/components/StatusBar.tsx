import { useGraphStore } from '../store/graphStore';
import { calculateStats, formatParamCount } from '../engine/stats';
import { Layers, Box, Hash } from 'lucide-react';

export default function StatusBar() {
  const nodes = useGraphStore(s => s.nodes);
  const stats = calculateStats(nodes);

  return (
    <div
      className="h-6 flex items-center px-3 gap-4 shrink-0 text-[10px]"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="flex items-center gap-1">
        <Box size={10} />
        <span>{stats.blockCount} blocks</span>
      </div>
      <div className="flex items-center gap-1">
        <Layers size={10} />
        <span>{stats.layerCount} layers</span>
      </div>
      <div className="flex items-center gap-1">
        <Hash size={10} />
        <span>{formatParamCount(stats.totalParams)} parameters</span>
      </div>
    </div>
  );
}
