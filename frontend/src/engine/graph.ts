import type { Edge } from '@xyflow/react';
import type { BlockNode } from '../store/graphStore';

export function topologicalSort(nodes: BlockNode[], edges: Edge[]): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

export function hasCycle(nodes: BlockNode[], edges: Edge[]): boolean {
  const sorted = topologicalSort(nodes, edges);
  return sorted.length !== nodes.length;
}

export function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(e => e.target === nodeId);
}

export function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(e => e.source === nodeId);
}
