import type { BlockDefinition } from '../types';

export const dropoutBlock: BlockDefinition = {
  type: 'Dropout',
  label: 'Dropout',
  category: 'regularization',
  description: 'Randomly zeros elements during training for regularization.',
  params: [
    { name: 'p', type: 'number', default: 0.5, min: 0, max: 1, label: 'Probability' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    return [[...inputShapes[0]]];
  },
  codeTemplate: {
    init: 'self.{label} = nn.Dropout(p={p})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};
