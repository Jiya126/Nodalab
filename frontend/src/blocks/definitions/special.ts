import type { BlockDefinition } from '../types';

export const inputBlock: BlockDefinition = {
  type: 'Input',
  label: 'Input',
  category: 'special',
  description: 'Network input tensor. Define the shape of data entering the model.',
  params: [
    { name: 'dims', type: 'string', default: 'null,512', label: 'Shape (comma-separated, null for batch)' },
  ],
  ports: {
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (_inputShapes, params) => {
    const dims = String(params.dims).split(',').map(d => {
      const trimmed = d.trim();
      if (trimmed === 'null' || trimmed === 'N' || trimmed === 'B') return null;
      const n = parseInt(trimmed, 10);
      return isNaN(n) ? null : n;
    });
    return [dims];
  },
  codeTemplate: {
    init: '',
    forward: '',
  },
};

export const outputBlock: BlockDefinition = {
  type: 'Output',
  label: 'Output',
  category: 'special',
  description: 'Network output. Marks the final output of the model.',
  params: [],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [],
  },
  shapeTransform: (inputShapes) => {
    return inputShapes.length > 0 ? [inputShapes[0]] : [];
  },
  codeTemplate: {
    init: '',
    forward: '',
  },
};
