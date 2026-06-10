import type { BlockDefinition, Shape } from '../types';

export const linearBlock: BlockDefinition = {
  type: 'Linear',
  label: 'Linear',
  category: 'layer',
  description: 'Fully connected layer. Applies y = xA^T + b.',
  params: [
    { name: 'in_features', type: 'number', default: 512, min: 1, label: 'In Features' },
    { name: 'out_features', type: 'number', default: 256, min: 1, label: 'Out Features' },
    { name: 'bias', type: 'boolean', default: true, label: 'Bias' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes, params) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    const shape = [...inputShapes[0]];
    shape[shape.length - 1] = params.out_features as number;
    return [shape];
  },
  codeTemplate: {
    init: 'self.{label} = nn.Linear({in_features}, {out_features}, bias={bias})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};

export const conv2dBlock: BlockDefinition = {
  type: 'Conv2d',
  label: 'Conv2d',
  category: 'layer',
  description: '2D convolution layer. For image and spatial data processing.',
  params: [
    { name: 'in_channels', type: 'number', default: 3, min: 1, label: 'In Channels' },
    { name: 'out_channels', type: 'number', default: 64, min: 1, label: 'Out Channels' },
    { name: 'kernel_size', type: 'number', default: 3, min: 1, label: 'Kernel Size' },
    { name: 'stride', type: 'number', default: 1, min: 1, label: 'Stride' },
    { name: 'padding', type: 'number', default: 1, min: 0, label: 'Padding' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes, params) => {
    if (inputShapes.length === 0 || !inputShapes[0] || inputShapes[0].length < 4) return [];
    const [batch, , h, w] = inputShapes[0];
    const k = params.kernel_size as number;
    const s = params.stride as number;
    const p = params.padding as number;
    const outH = h !== null ? Math.floor((h + 2 * p - k) / s) + 1 : null;
    const outW = w !== null ? Math.floor((w + 2 * p - k) / s) + 1 : null;
    return [[batch, params.out_channels as number, outH, outW]];
  },
  codeTemplate: {
    init: 'self.{label} = nn.Conv2d({in_channels}, {out_channels}, kernel_size={kernel_size}, stride={stride}, padding={padding})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};

export const embeddingBlock: BlockDefinition = {
  type: 'Embedding',
  label: 'Embedding',
  category: 'layer',
  description: 'Embedding layer. Maps integer indices to dense vectors.',
  params: [
    { name: 'num_embeddings', type: 'number', default: 10000, min: 1, label: 'Vocab Size' },
    { name: 'embedding_dim', type: 'number', default: 512, min: 1, label: 'Embedding Dim' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes, params) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    const shape = [...inputShapes[0], params.embedding_dim as number];
    return [shape];
  },
  codeTemplate: {
    init: 'self.{label} = nn.Embedding({num_embeddings}, {embedding_dim})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};

export const multiHeadAttentionBlock: BlockDefinition = {
  type: 'MultiHeadAttention',
  label: 'MultiHeadAttention',
  category: 'layer',
  description: 'Multi-head attention mechanism. Core component of transformers.',
  params: [
    { name: 'embed_dim', type: 'number', default: 512, min: 1, label: 'Embed Dim' },
    { name: 'num_heads', type: 'number', default: 8, min: 1, label: 'Num Heads' },
    { name: 'dropout', type: 'number', default: 0.0, min: 0, max: 1, label: 'Dropout' },
  ],
  ports: {
    inputs: [
      { id: 'query', label: 'Query' },
      { id: 'key', label: 'Key' },
      { id: 'value', label: 'Value' },
    ],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes: Shape[], params) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    const queryShape = inputShapes[0];
    const shape = [...queryShape];
    shape[shape.length - 1] = params.embed_dim as number;
    return [shape];
  },
  codeTemplate: {
    init: 'self.{label} = nn.MultiheadAttention({embed_dim}, {num_heads}, dropout={dropout})',
    forward: '{out}, _ = self.{label}({query}, {key}, {value})',
    imports: ['torch.nn as nn'],
  },
};

export const layerNormBlock: BlockDefinition = {
  type: 'LayerNorm',
  label: 'LayerNorm',
  category: 'layer',
  description: 'Layer normalization. Normalizes across the feature dimension.',
  params: [
    { name: 'normalized_shape', type: 'number', default: 512, min: 1, label: 'Normalized Shape' },
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
    init: 'self.{label} = nn.LayerNorm({normalized_shape})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};

export const batchNorm2dBlock: BlockDefinition = {
  type: 'BatchNorm2d',
  label: 'BatchNorm2d',
  category: 'layer',
  description: 'Batch normalization for 2D inputs (4D tensor: B,C,H,W).',
  params: [
    { name: 'num_features', type: 'number', default: 64, min: 1, label: 'Num Features' },
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
    init: 'self.{label} = nn.BatchNorm2d({num_features})',
    forward: '{out} = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};

export const lstmBlock: BlockDefinition = {
  type: 'LSTM',
  label: 'LSTM',
  category: 'layer',
  description: 'Long Short-Term Memory recurrent layer.',
  params: [
    { name: 'input_size', type: 'number', default: 512, min: 1, label: 'Input Size' },
    { name: 'hidden_size', type: 'number', default: 256, min: 1, label: 'Hidden Size' },
    { name: 'num_layers', type: 'number', default: 1, min: 1, label: 'Num Layers' },
    { name: 'bidirectional', type: 'boolean', default: false, label: 'Bidirectional' },
  ],
  ports: {
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
  shapeTransform: (inputShapes, params) => {
    if (inputShapes.length === 0 || !inputShapes[0]) return [];
    const shape = [...inputShapes[0]];
    const hidden = params.hidden_size as number;
    const bidir = params.bidirectional ? 2 : 1;
    shape[shape.length - 1] = hidden * bidir;
    return [shape];
  },
  codeTemplate: {
    init: 'self.{label} = nn.LSTM({input_size}, {hidden_size}, num_layers={num_layers}, bidirectional={bidirectional}, batch_first=True)',
    forward: '{out}, _ = self.{label}({in})',
    imports: ['torch.nn as nn'],
  },
};
