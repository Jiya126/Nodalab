import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type { BlockNodeData, SerializedGraph } from '../blocks/types';
import { getBlockDefinition } from '../blocks/registry';
import { propagateShapes } from '../engine/shapeEngine';
import { generateCode } from '../engine/codeGenerator';

export type BlockNode = Node<BlockNodeData>;
export type BlockEdge = Edge;

interface HistoryEntry {
  nodes: BlockNode[];
  edges: BlockEdge[];
}

interface GraphState {
  projectName: string;
  projectId: string;
  nodes: BlockNode[];
  edges: BlockEdge[];
  generatedCode: string;

  history: HistoryEntry[];
  historyIndex: number;

  setProjectName: (name: string) => void;
  onNodesChange: (changes: NodeChange<BlockNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<BlockEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (blockType: string, position: { x: number; y: number }) => void;
  updateNodeParams: (nodeId: string, params: Record<string, unknown>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  recalculate: () => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  exportToJSON: () => string;
  importFromJSON: (json: string) => void;
  clearGraph: () => void;
}

function makeNodeLabel(blockType: string, existingNodes: BlockNode[]): string {
  const prefix = blockType.toLowerCase();
  const existing = existingNodes
    .filter(n => n.data.blockType === blockType)
    .map(n => {
      const match = n.data.label.match(/_(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const next = existing.length === 0 ? 1 : Math.max(...existing) + 1;
  return `${prefix}_${next}`;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  projectName: 'Untitled Network',
  projectId: uuidv4(),
  nodes: [],
  edges: [],
  generatedCode: '',
  history: [],
  historyIndex: -1,

  setProjectName: (name) => set({ projectName: name }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
    const isDrag = changes.every(c => c.type === 'position');
    if (!isDrag) {
      get().recalculate();
    }
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
    get().recalculate();
  },

  onConnect: (connection) => {
    const { edges } = get();
    const alreadyExists = edges.some(
      e => e.target === connection.target && e.targetHandle === connection.targetHandle
    );
    if (alreadyExists) return;

    get().pushHistory();
    const newEdge: BlockEdge = {
      id: `edge-${uuidv4()}`,
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: connection.targetHandle,
      type: 'smoothstep',
    };
    set((state) => ({ edges: [...state.edges, newEdge] }));
    get().recalculate();
  },

  addNode: (blockType, position) => {
    const def = getBlockDefinition(blockType);
    if (!def) return;

    get().pushHistory();
    const label = makeNodeLabel(blockType, get().nodes);
    const defaultParams: Record<string, unknown> = {};
    for (const p of def.params) {
      defaultParams[p.name] = p.default;
    }

    const newNode: BlockNode = {
      id: `node-${uuidv4()}`,
      type: 'blockNode',
      position,
      data: {
        blockType,
        label,
        params: defaultParams,
      },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    get().recalculate();
  },

  updateNodeParams: (nodeId, params) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } }
          : n
      ),
    }));
    get().recalculate();
  },

  updateNodeLabel: (nodeId, label) => {
    set((state) => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
      ),
    }));
    get().recalculate();
  },

  deleteSelected: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    get().pushHistory();
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    set({
      nodes: nodes.filter(n => !n.selected),
      edges: edges.filter(e =>
        !e.selected &&
        !selectedNodeIds.has(e.source) &&
        !selectedNodeIds.has(e.target)
      ),
    });
    get().recalculate();
  },

  duplicateSelected: () => {
    const { nodes } = get();
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) return;

    get().pushHistory();
    const newNodes: BlockNode[] = selected.map(n => ({
      ...n,
      id: `node-${uuidv4()}`,
      position: { x: n.position.x + 50, y: n.position.y + 50 },
      selected: false,
      data: {
        ...n.data,
        label: makeNodeLabel(n.data.blockType, [...get().nodes]),
      },
    }));
    set((state) => ({ nodes: [...state.nodes, ...newNodes] }));
    get().recalculate();
  },

  recalculate: () => {
    const { nodes, edges } = get();
    const updatedNodes = propagateShapes(nodes, edges);
    const code = generateCode(updatedNodes, edges);
    set({ nodes: updatedNodes, generatedCode: code });
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < 0) return;
    const entry = history[historyIndex];
    set({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      historyIndex: historyIndex - 1,
    });
    get().recalculate();
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    set({
      nodes: JSON.parse(JSON.stringify(entry.nodes)),
      edges: JSON.parse(JSON.stringify(entry.edges)),
      historyIndex: historyIndex + 1,
    });
    get().recalculate();
  },

  saveToLocalStorage: () => {
    const { projectId, projectName, nodes, edges } = get();
    const data: SerializedGraph = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`nodalab-project-${projectId}`, JSON.stringify(data));
    const projectList = JSON.parse(localStorage.getItem('nodalab-projects') || '[]') as string[];
    if (!projectList.includes(projectId)) {
      projectList.push(projectId);
      localStorage.setItem('nodalab-projects', JSON.stringify(projectList));
    }
  },

  loadFromLocalStorage: () => {
    const { projectId } = get();
    const raw = localStorage.getItem(`nodalab-project-${projectId}`);
    if (!raw) return false;

    const data: SerializedGraph = JSON.parse(raw);
    const nodes: BlockNode[] = data.nodes.map(n => ({
      id: n.id,
      type: 'blockNode',
      position: n.position,
      data: n.data,
    }));
    const edges: BlockEdge[] = data.edges.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      type: 'smoothstep',
    }));
    set({ projectName: data.name, nodes, edges });
    get().recalculate();
    return true;
  },

  exportToJSON: () => {
    const { projectId, projectName, nodes, edges } = get();
    const data: SerializedGraph = {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  },

  importFromJSON: (json) => {
    const data: SerializedGraph = JSON.parse(json);
    const nodes: BlockNode[] = data.nodes.map(n => ({
      id: n.id,
      type: 'blockNode',
      position: n.position,
      data: n.data,
    }));
    const edges: BlockEdge[] = data.edges.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      type: 'smoothstep',
    }));
    set({
      projectId: data.id,
      projectName: data.name,
      nodes,
      edges,
      history: [],
      historyIndex: -1,
    });
    get().recalculate();
  },

  clearGraph: () => {
    get().pushHistory();
    set({ nodes: [], edges: [] });
    get().recalculate();
  },
}));
