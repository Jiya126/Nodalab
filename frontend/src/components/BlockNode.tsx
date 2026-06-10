import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BlockNodeData } from '../blocks/types';
import { getBlockDefinition } from '../blocks/registry';
import { formatShape } from '../engine/shapeEngine';
import type { BlockNode as BlockNodeType } from '../store/graphStore';

const CATEGORY_COLORS: Record<string, string> = {
  layer: '#6366f1',
  activation: '#22c55e',
  operation: '#f59e0b',
  regularization: '#ef4444',
  pooling: '#06b6d4',
  special: '#8b5cf6',
};

function BlockNode({ data, selected }: NodeProps<BlockNodeType>) {
  const nodeData = data as BlockNodeData;
  const def = getBlockDefinition(nodeData.blockType);
  if (!def) return null;

  const color = CATEGORY_COLORS[def.category] || '#6366f1';
  const hasError = !!nodeData.shapeError;

  return (
    <div
      className="relative min-w-[160px] rounded-lg shadow-lg"
      style={{
        background: '#1a1d27',
        border: `2px solid ${hasError ? '#ef4444' : selected ? color : '#2e3348'}`,
      }}
    >
      <div
        className="px-3 py-1.5 rounded-t-md text-xs font-semibold text-white flex items-center justify-between"
        style={{ background: color }}
      >
        <span>{def.type}</span>
        <span className="opacity-70 text-[10px] ml-2">{def.category}</span>
      </div>

      <div className="px-3 py-2">
        <div className="text-xs text-zinc-300 font-mono mb-1">{nodeData.label}</div>

        {nodeData.outputShapes && nodeData.outputShapes.length > 0 && (
          <div className="text-[10px] text-zinc-500 font-mono">
            {nodeData.outputShapes.map((s, i) => (
              <span key={i}>out: {formatShape(s)}</span>
            ))}
          </div>
        )}

        {hasError && (
          <div className="text-[10px] text-red-400 mt-1 truncate max-w-[200px]">
            {nodeData.shapeError}
          </div>
        )}
      </div>

      {def.ports.inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${30 + ((i + 1) * 40) / (def.ports.inputs.length + 1) + i * 12}px`,
            width: 10,
            height: 10,
            background: '#2e3348',
            border: `2px solid ${color}`,
          }}
          title={port.label}
        />
      ))}

      {def.ports.outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            top: `${30 + ((i + 1) * 40) / (def.ports.outputs.length + 1) + i * 12}px`,
            width: 10,
            height: 10,
            background: color,
            border: `2px solid ${color}`,
          }}
          title={port.label}
        />
      ))}

      {def.ports.inputs.length > 1 && def.ports.inputs.map((port, i) => (
        <div
          key={`label-${port.id}`}
          className="absolute text-[9px] text-zinc-500"
          style={{
            left: 14,
            top: `${26 + ((i + 1) * 40) / (def.ports.inputs.length + 1) + i * 12}px`,
          }}
        >
          {port.label}
        </div>
      ))}
    </div>
  );
}

export default memo(BlockNode);
