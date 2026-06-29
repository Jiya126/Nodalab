import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BlockNodeData } from '../blocks/types';
import { getBlockDefinition } from '../blocks/registry';
import { formatShape } from '../engine/shapeEngine';
import type { BlockNode as BlockNodeType } from '../store/graphStore';
import { useTrainingStore } from '../store/trainingStore';

const CATEGORY_COLORS: Record<string, string> = {
  layer: '#6366f1',
  activation: '#22c55e',
  operation: '#f59e0b',
  regularization: '#ef4444',
  pooling: '#06b6d4',
  special: '#8b5cf6',
};

function formatMetric(value: number): string {
  if (value === 0) return '0';
  if (value < 0.01) return value.toExponential(1);
  if (value < 100) return value.toFixed(2);
  return value.toExponential(1);
}

function metricIntensity(value: number): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log10(value + 1) / 2);
}

function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const nodeData = data as BlockNodeData;
  const def = getBlockDefinition(nodeData.blockType);
  const telemetry = useTrainingStore(s => s.telemetry);
  if (!def) return null;

  const color = CATEGORY_COLORS[def.category] || '#6366f1';
  const hasError = !!nodeData.shapeError;
  const metrics = telemetry?.nodes[id];
  const updateIntensity = metricIntensity(metrics?.update ?? 0);
  const gradientIntensity = metricIntensity(metrics?.gradient ?? 0);
  const activationIntensity = metricIntensity(metrics?.activation ?? 0);
  const telemetryColor = updateIntensity > 0
    ? '#f97316'
    : gradientIntensity > 0
      ? '#22c55e'
      : color;

  return (
    <div
      className="relative min-w-[160px] rounded-lg shadow-lg"
      style={{
        background: '#1a1d27',
        border: `2px solid ${hasError ? '#ef4444' : selected ? color : metrics ? telemetryColor : '#2e3348'}`,
        boxShadow: metrics
          ? `0 0 ${8 + updateIntensity * 18}px rgba(249, 115, 22, ${0.15 + updateIntensity * 0.45})`
          : undefined,
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

        {metrics && (
          <div className="mt-2 space-y-1">
            <MetricBar label="act" value={metrics.activation} intensity={activationIntensity} color="#60a5fa" />
            <MetricBar label="grad" value={metrics.gradient} intensity={gradientIntensity} color="#22c55e" />
            <MetricBar label="upd" value={metrics.update} intensity={updateIntensity} color="#f97316" />
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

function MetricBar({ label, value, intensity, color }: {
  label: string;
  value: number;
  intensity: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_42px] items-center gap-1 text-[9px] font-mono">
      <span className="text-zinc-500">{label}</span>
      <div className="h-1 rounded bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: `${Math.max(4, intensity * 100)}%`,
            background: color,
          }}
        />
      </div>
      <span className="text-right text-zinc-500">{formatMetric(value)}</span>
    </div>
  );
}

export default memo(BlockNode);
