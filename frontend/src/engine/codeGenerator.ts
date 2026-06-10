import type { Edge } from '@xyflow/react';
import type { BlockNode } from '../store/graphStore';
import { getBlockDefinition } from '../blocks/registry';
import { topologicalSort, getIncomingEdges } from './graph';

function pythonBool(val: unknown): string {
  if (typeof val === 'boolean') return val ? 'True' : 'False';
  return String(val);
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? key);
}

export function generateCode(nodes: BlockNode[], edges: Edge[]): string {
  if (nodes.length === 0) return '# Add blocks to the canvas to generate code';

  const sorted = topologicalSort(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const imports = new Set<string>();
  imports.add('import torch');
  imports.add('import torch.nn as nn');

  const initLines: string[] = [];
  const forwardLines: string[] = [];

  const varNames = new Map<string, string>();
  const inputNodes: string[] = [];

  for (const nodeId of sorted) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const def = getBlockDefinition(node.data.blockType);
    if (!def) continue;

    if (def.codeTemplate.imports) {
      for (const imp of def.codeTemplate.imports) {
        imports.add(`import ${imp}`);
      }
    }

    const label = node.data.label;

    if (node.data.blockType === 'Input') {
      varNames.set(nodeId, label);
      inputNodes.push(label);
      continue;
    }

    if (node.data.blockType === 'Output') {
      const incoming = getIncomingEdges(nodeId, edges);
      if (incoming.length > 0) {
        const sourceVar = varNames.get(incoming[0].source) || 'x';
        varNames.set(nodeId, sourceVar);
      }
      continue;
    }

    const paramVars: Record<string, string> = { label };
    for (const [key, val] of Object.entries(node.data.params)) {
      paramVars[key] = pythonBool(val);
    }

    if (def.codeTemplate.init) {
      initLines.push(`        ${interpolate(def.codeTemplate.init, paramVars)}`);
    }

    const incoming = getIncomingEdges(nodeId, edges);
    const inputVarMap: Record<string, string> = {};

    for (const port of def.ports.inputs) {
      const edge = incoming.find(e => e.targetHandle === port.id);
      if (edge) {
        inputVarMap[port.id] = varNames.get(edge.source) || 'x';
      } else {
        inputVarMap[port.id] = label;
      }
    }

    if (def.ports.inputs.length === 1) {
      inputVarMap['in'] = inputVarMap[def.ports.inputs[0].id] || 'x';
    }

    const outVar = label;
    varNames.set(nodeId, outVar);

    const forwardVars: Record<string, string> = {
      ...paramVars,
      ...inputVarMap,
      out: outVar,
    };

    if (def.codeTemplate.forward) {
      forwardLines.push(`        ${interpolate(def.codeTemplate.forward, forwardVars)}`);
    }
  }

  const outputNodes = nodes.filter(n => n.data.blockType === 'Output');
  let returnStatement = '';
  if (outputNodes.length > 0) {
    const outputVars = outputNodes.map(n => {
      const incoming = getIncomingEdges(n.id, edges);
      return incoming.length > 0 ? varNames.get(incoming[0].source) || 'x' : 'x';
    });
    returnStatement =
      outputVars.length === 1
        ? `        return ${outputVars[0]}`
        : `        return ${outputVars.join(', ')}`;
  } else if (forwardLines.length > 0) {
    const lastVar = varNames.get(sorted[sorted.length - 1]) || 'x';
    returnStatement = `        return ${lastVar}`;
  }

  const inputArgs = inputNodes.length > 0 ? inputNodes.join(', ') : 'x';

  const sortedImports = Array.from(imports).sort();

  const code = `${sortedImports.join('\n')}


class NeuralNetwork(nn.Module):
    def __init__(self):
        super().__init__()
${initLines.length > 0 ? initLines.join('\n') : '        pass'}

    def forward(self, ${inputArgs}):
${forwardLines.length > 0 ? forwardLines.join('\n') : '        pass'}
${returnStatement ? '\n' + returnStatement : ''}
`;

  return code.trimEnd() + '\n';
}
