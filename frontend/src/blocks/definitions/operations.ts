import type { BlockDefinition, Shape } from '../types';

export const addBlock: BlockDefinition = {
  type: 'Add',
  label: 'Add',
  category: 'operation',
  description: 'Element-wise addition (residual connection). Adds two tensors of the same shape.',
  params: [],
  ports: {
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes: Shape[]) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    return [[...inputShapes[0]]];
  },
  codeTemplate: {
    init: '',
    forward: '{out} = {a} + {b}',
  },
};

export const concatBlock: BlockDefinition = {
  type: 'Concat',
  label: 'Concat',
  category: 'operation',
  description: 'Concatenate tensors along a dimension.',
  params: [
    { name: 'dim', type: 'number', default: -1, label: 'Dim' },
  ],
  ports: {
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes: Shape[], params) => {
    if (inputShapes.length < 2 || !inputShapes[0] || !inputShapes[1]) return [];
    const dim = params.dim as number;
    const shape = [...inputShapes[0]];
    const actualDim = dim < 0 ? shape.length + dim : dim;
    const d0 = inputShapes[0][actualDim];
    const d1 = inputShapes[1][actualDim];
    shape[actualDim] = d0 !== null && d1 !== null ? d0 + d1 : null;
    return [shape];
  },
  codeTemplate: {
    init: '',
    forward: '{out} = torch.cat([{a}, {b}], dim={dim})',
    imports: ['torch'],
  },
};

export const reshapeBlock: BlockDefinition = {
  type: 'Reshape',
  label: 'Reshape',
  category: 'operation',
  description: 'Reshape tensor to a new shape.',
  params: [
    { name: 'shape', type: 'string', default: 'null,-1', label: 'Target Shape (comma-separated)' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (_inputShapes, params) => {
    const dims = String(params.shape).split(',').map(d => {
      const trimmed = d.trim();
      if (trimmed === 'null' || trimmed === '-1' || trimmed === 'B') return null;
      const n = parseInt(trimmed, 10);
      return isNaN(n) ? null : n;
    });
    return [dims];
  },
  codeTemplate: {
    init: '',
    forward: '{out} = {in}.view({shape})',
  },
};

export const flattenBlock: BlockDefinition = {
  type: 'Flatten',
  label: 'Flatten',
  category: 'operation',
  description: 'Flatten tensor dimensions.',
  params: [
    { name: 'start_dim', type: 'number', default: 1, min: 0, label: 'Start Dim' },
    { name: 'end_dim', type: 'number', default: -1, label: 'End Dim' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes, params) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    const shape = inputShapes[0];
    const startDim = params.start_dim as number;
    const endDim = (params.end_dim as number) < 0 ? shape.length + (params.end_dim as number) : (params.end_dim as number);

    const before = shape.slice(0, startDim);
    const flatDims = shape.slice(startDim, endDim + 1);
    const after = shape.slice(endDim + 1);

    let flatSize: number | null = 1;
    for (const d of flatDims) {
      if (d === null) { flatSize = null; break; }
      flatSize *= d;
    }

    return [[...before, flatSize, ...after]];
  },
  codeTemplate: {
    init: 'self.{label} = nn.Flatten(start_dim={start_dim}, end_dim={end_dim})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};
