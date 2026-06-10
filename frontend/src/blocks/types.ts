export type Shape = (number | null)[];

export type ParamType = 'number' | 'boolean' | 'select' | 'string';

export interface ParamDefinition {
  name: string;
  type: ParamType;
  default: number | boolean | string;
  options?: string[];
  min?: number;
  max?: number;
  label?: string;
}

export interface PortDefinition {
  id: string;
  label: string;
}

export interface BlockDefinition {
  type: string;
  label: string;
  category: 'layer' | 'activation' | 'operation' | 'regularization' | 'pooling' | 'special';
  description: string;
  params: ParamDefinition[];
  ports: {
    inputs: PortDefinition[];
    outputs: PortDefinition[];
  };
  shapeTransform: (inputShapes: Shape[], params: Record<string, unknown>) => Shape[];
  codeTemplate: {
    init: string;
    forward: string;
    imports?: string[];
  };
}

export interface BlockNodeData {
  [key: string]: unknown;
  blockType: string;
  label: string;
  params: Record<string, unknown>;
  inputShapes?: Shape[];
  outputShapes?: Shape[];
  shapeError?: string;
}

export interface SerializedGraph {
  id: string;
  name: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BlockNodeData;
}

export interface SerializedEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
}
