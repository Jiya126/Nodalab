import type { BlockDefinition } from '../types';

function passthroughShape(inputShapes: (number | null)[][]) {
  if (inputShapes.length === 0 || !inputShapes[0]) return [];
  return [[...inputShapes[0]]];
}

export const reluBlock: BlockDefinition = {
  type: 'ReLU',
  label: 'ReLU',
  category: 'activation',
  description: 'Rectified Linear Unit activation. f(x) = max(0, x).',
  params: [],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: passthroughShape,
  codeTemplate: {
    init: '',
    forward: '{out} = F.relu({in})',
    imports: ['torch.nn.functional as F'],
  },
};

export const geluBlock: BlockDefinition = {
  type: 'GELU',
  label: 'GELU',
  category: 'activation',
  description: 'Gaussian Error Linear Unit. Smooth approximation of ReLU used in transformers.',
  params: [],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: passthroughShape,
  codeTemplate: {
    init: '',
    forward: '{out} = F.gelu({in})',
    imports: ['torch.nn.functional as F'],
  },
};

export const softmaxBlock: BlockDefinition = {
  type: 'Softmax',
  label: 'Softmax',
  category: 'activation',
  description: 'Softmax activation. Normalizes to a probability distribution.',
  params: [
    { name: 'dim', type: 'number', default: -1, label: 'Dim' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: passthroughShape,
  codeTemplate: {
    init: '',
    forward: '{out} = F.softmax({in}, dim={dim})',
    imports: ['torch.nn.functional as F'],
  },
};

export const sigmoidBlock: BlockDefinition = {
  type: 'Sigmoid',
  label: 'Sigmoid',
  category: 'activation',
  description: 'Sigmoid activation. Maps to (0, 1).',
  params: [],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: passthroughShape,
  codeTemplate: {
    init: '',
    forward: '{out} = torch.sigmoid({in})',
    imports: ['torch'],
  },
};
