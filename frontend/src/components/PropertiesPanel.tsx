import { useGraphStore } from '../store/graphStore';
import { useUIStore } from '../store/uiStore';
import { getBlockDefinition } from '../blocks/registry';
import type { ParamDefinition } from '../blocks/types';
import { formatShape } from '../engine/shapeEngine';
import { X } from 'lucide-react';

function ParamInput({ param, value, onChange }: {
  param: ParamDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  switch (param.type) {
    case 'number':
      return (
        <input
          type="number"
          value={value as number}
          min={param.min}
          max={param.max}
          step={param.name === 'p' || param.name === 'dropout' ? 0.1 : 1}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
      );
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={e => onChange(e.target.checked)}
            className="accent-indigo-500"
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {value ? 'True' : 'False'}
          </span>
        </label>
      );
    case 'select':
      return (
        <select
          value={value as string}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          {param.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'string':
    default:
      return (
        <input
          type="text"
          value={value as string}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1 rounded text-xs outline-none"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
      );
  }
}

export default function PropertiesPanel() {
  const selectedNodeId = useUIStore(s => s.selectedNodeId);
  const nodes = useGraphStore(s => s.nodes);
  const updateNodeParams = useGraphStore(s => s.updateNodeParams);
  const updateNodeLabel = useGraphStore(s => s.updateNodeLabel);
  const setSelectedNodeId = useUIStore(s => s.setSelectedNodeId);

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) {
    return (
      <div
        className="h-full flex items-center justify-center text-xs"
        style={{
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        Select a block to edit properties
      </div>
    );
  }

  const def = getBlockDefinition(node.data.blockType);
  if (!def) return null;

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-color)',
      }}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {def.type}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {def.category}
          </div>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            LABEL
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={e => updateNodeLabel(node.id, e.target.value)}
            className="w-full px-2 py-1 rounded text-xs outline-none font-mono"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {def.params.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              PARAMETERS
            </div>
            <div className="space-y-2">
              {def.params.map(param => (
                <div key={param.name}>
                  <label className="text-[10px] mb-0.5 block" style={{ color: 'var(--text-muted)' }}>
                    {param.label || param.name}
                  </label>
                  <ParamInput
                    param={param}
                    value={node.data.params[param.name]}
                    onChange={val => updateNodeParams(node.id, { [param.name]: val })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {node.data.inputShapes && node.data.inputShapes.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              INPUT SHAPES
            </div>
            {node.data.inputShapes.map((s, i) => (
              <div key={i} className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {def.ports.inputs[i]?.label}: {formatShape(s)}
              </div>
            ))}
          </div>
        )}

        {node.data.outputShapes && node.data.outputShapes.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              OUTPUT SHAPES
            </div>
            {node.data.outputShapes.map((s, i) => (
              <div key={i} className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
                {def.ports.outputs[i]?.label}: {formatShape(s)}
              </div>
            ))}
          </div>
        )}

        {node.data.shapeError && (
          <div className="p-2 rounded text-xs" style={{ background: '#ef444420', color: '#ef4444' }}>
            {node.data.shapeError}
          </div>
        )}

        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {def.description}
        </div>
      </div>
    </div>
  );
}
