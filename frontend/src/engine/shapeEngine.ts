import type { Edge } from '@xyflow/react';
import type { BlockNode } from '../store/graphStore';
import type { Shape } from '../blocks/types';
import { getBlockDefinition } from '../blocks/registry';
import { topologicalSort, getIncomingEdges } from './graph';

export function propagateShapes(nodes: BlockNode[], edges: Edge[]): BlockNode[] {
  const sorted = topologicalSort(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, data: { ...n.data } }]));
  const outputShapes = new Map<string, Shape[]>();

  for (const nodeId of sorted) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const def = getBlockDefinition(node.data.blockType);
    if (!def) continue;

    const incoming = getIncomingEdges(nodeId, edges);
    const inputShapes: Shape[] = [];

    for (const port of def.ports.inputs) {
      const edge = incoming.find(e => e.targetHandle === port.id);
      if (edge) {
        const sourceShapes = outputShapes.get(edge.source);
        const sourceNode = nodeMap.get(edge.source);
        if (sourceShapes && sourceNode) {
          const sourceDef = getBlockDefinition(sourceNode.data.blockType);
          if (sourceDef) {
            const sourcePortIndex = sourceDef.ports.outputs.findIndex(
              p => p.id === edge.sourceHandle
            );
            if (sourcePortIndex >= 0 && sourceShapes[sourcePortIndex]) {
              inputShapes.push(sourceShapes[sourcePortIndex]);
              continue;
            }
          }
        }
      }
      inputShapes.push([]);
    }

    const validInputs = inputShapes.filter(s => s.length > 0);

    try {
      if (def.ports.inputs.length === 0 || validInputs.length > 0) {
        const shapes = def.shapeTransform(inputShapes, node.data.params);
        outputShapes.set(nodeId, shapes);
        node.data.outputShapes = shapes;
        node.data.inputShapes = inputShapes;
        node.data.shapeError = undefined;
      } else {
        outputShapes.set(nodeId, []);
        node.data.outputShapes = [];
        node.data.inputShapes = inputShapes;
        node.data.shapeError = undefined;
      }
    } catch (err) {
      node.data.shapeError = err instanceof Error ? err.message : 'Shape error';
      outputShapes.set(nodeId, []);
      node.data.outputShapes = [];
    }
  }

  return nodes.map(n => nodeMap.get(n.id) || n);
}

export function formatShape(shape: Shape): string {
  if (!shape || shape.length === 0) return '?';
  return '[' + shape.map(d => (d === null ? 'B' : d)).join(', ') + ']';
}
