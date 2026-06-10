import type { BlockNode, BlockEdge } from '../store/graphStore';

interface ShareData {
  n: string;
  nodes: Array<{
    id: string;
    t: string;
    x: number;
    y: number;
    bt: string;
    l: string;
    p: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    s: string;
    sh: string | null;
    t: string;
    th: string | null;
  }>;
}

export function encodeGraphToURL(
  projectName: string,
  nodes: BlockNode[],
  edges: BlockEdge[]
): string {
  const data: ShareData = {
    n: projectName,
    nodes: nodes.map(n => ({
      id: n.id,
      t: 'blockNode',
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      bt: n.data.blockType,
      l: n.data.label,
      p: n.data.params,
    })),
    edges: edges.map(e => ({
      id: e.id,
      s: e.source,
      sh: e.sourceHandle ?? null,
      t: e.target,
      th: e.targetHandle ?? null,
    })),
  };

  const json = JSON.stringify(data);
  const compressed = btoa(encodeURIComponent(json));
  return `${window.location.origin}${window.location.pathname}?graph=${compressed}`;
}

export function decodeGraphFromURL(encoded: string): {
  projectName: string;
  nodes: BlockNode[];
  edges: BlockEdge[];
} | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const data: ShareData = JSON.parse(json);

    const nodes: BlockNode[] = data.nodes.map(n => ({
      id: n.id,
      type: 'blockNode',
      position: { x: n.x, y: n.y },
      data: {
        blockType: n.bt,
        label: n.l,
        params: n.p,
      },
    }));

    const edges: BlockEdge[] = data.edges.map(e => ({
      id: e.id,
      source: e.s,
      sourceHandle: e.sh,
      target: e.t,
      targetHandle: e.th,
      type: 'smoothstep',
    }));

    return { projectName: data.n, nodes, edges };
  } catch {
    return null;
  }
}
