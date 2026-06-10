import { v4 as uuidv4 } from 'uuid';
import type { BlockNode, BlockEdge } from '../store/graphStore';

export interface Template {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: BlockNode[]; edges: BlockEdge[] };
}

function node(
  blockType: string,
  label: string,
  x: number,
  y: number,
  params: Record<string, unknown> = {}
): BlockNode {
  return {
    id: `node-${uuidv4()}`,
    type: 'blockNode',
    position: { x, y },
    data: { blockType, label, params },
  };
}

function edge(source: BlockNode, target: BlockNode, sourceHandle = 'out', targetHandle = 'in'): BlockEdge {
  return {
    id: `edge-${uuidv4()}`,
    source: source.id,
    sourceHandle,
    target: target.id,
    targetHandle,
    type: 'smoothstep',
  };
}

export const templates: Template[] = [
  {
    id: 'mlp',
    name: 'MLP (Multi-Layer Perceptron)',
    description: 'Simple feedforward network with 3 linear layers.',
    build: () => {
      const input = node('Input', 'input', 0, 200, { dims: 'null,784' });
      const fc1 = node('Linear', 'fc1', 250, 200, { in_features: 784, out_features: 256, bias: true });
      const relu1 = node('ReLU', 'relu_1', 500, 200);
      const drop1 = node('Dropout', 'dropout_1', 700, 200, { p: 0.2 });
      const fc2 = node('Linear', 'fc2', 900, 200, { in_features: 256, out_features: 128, bias: true });
      const relu2 = node('ReLU', 'relu_2', 1150, 200);
      const fc3 = node('Linear', 'fc3', 1350, 200, { in_features: 128, out_features: 10, bias: true });
      const output = node('Output', 'output', 1600, 200);

      return {
        nodes: [input, fc1, relu1, drop1, fc2, relu2, fc3, output],
        edges: [
          edge(input, fc1),
          edge(fc1, relu1),
          edge(relu1, drop1),
          edge(drop1, fc2),
          edge(fc2, relu2),
          edge(relu2, fc3),
          edge(fc3, output),
        ],
      };
    },
  },
  {
    id: 'cnn',
    name: 'CNN (Image Classifier)',
    description: 'Convolutional neural network for image classification.',
    build: () => {
      const input = node('Input', 'input', 0, 200, { dims: 'null,3,32,32' });
      const conv1 = node('Conv2d', 'conv1', 250, 200, { in_channels: 3, out_channels: 32, kernel_size: 3, stride: 1, padding: 1 });
      const relu1 = node('ReLU', 'relu_1', 500, 200);
      const bn1 = node('BatchNorm2d', 'bn_1', 700, 200, { num_features: 32 });
      const conv2 = node('Conv2d', 'conv2', 900, 200, { in_channels: 32, out_channels: 64, kernel_size: 3, stride: 2, padding: 1 });
      const relu2 = node('ReLU', 'relu_2', 1150, 200);
      const flat = node('Flatten', 'flatten_1', 1350, 200, { start_dim: 1, end_dim: -1 });
      const fc1 = node('Linear', 'fc1', 1550, 200, { in_features: 16384, out_features: 128, bias: true });
      const relu3 = node('ReLU', 'relu_3', 1750, 200);
      const fc2 = node('Linear', 'fc2', 1950, 200, { in_features: 128, out_features: 10, bias: true });
      const output = node('Output', 'output', 2150, 200);

      return {
        nodes: [input, conv1, relu1, bn1, conv2, relu2, flat, fc1, relu3, fc2, output],
        edges: [
          edge(input, conv1),
          edge(conv1, relu1),
          edge(relu1, bn1),
          edge(bn1, conv2),
          edge(conv2, relu2),
          edge(relu2, flat),
          edge(flat, fc1),
          edge(fc1, relu3),
          edge(relu3, fc2),
          edge(fc2, output),
        ],
      };
    },
  },
  {
    id: 'transformer-encoder',
    name: 'Transformer Encoder Block',
    description: 'Single transformer encoder layer with self-attention and feedforward.',
    build: () => {
      const input = node('Input', 'input', 0, 250, { dims: 'null,64,512' });
      const ln1 = node('LayerNorm', 'ln_1', 250, 250, { normalized_shape: 512 });
      const attn = node('MultiHeadAttention', 'mha_1', 500, 150, { embed_dim: 512, num_heads: 8, dropout: 0.1 });
      const drop1 = node('Dropout', 'dropout_1', 750, 250, { p: 0.1 });
      const add1 = node('Add', 'add_1', 950, 250);
      const ln2 = node('LayerNorm', 'ln_2', 1150, 250, { normalized_shape: 512 });
      const ff1 = node('Linear', 'ff1', 1350, 250, { in_features: 512, out_features: 2048, bias: true });
      const gelu = node('GELU', 'gelu_1', 1550, 250);
      const ff2 = node('Linear', 'ff2', 1750, 250, { in_features: 2048, out_features: 512, bias: true });
      const drop2 = node('Dropout', 'dropout_2', 1950, 250, { p: 0.1 });
      const add2 = node('Add', 'add_2', 2150, 250);
      const output = node('Output', 'output', 2400, 250);

      return {
        nodes: [input, ln1, attn, drop1, add1, ln2, ff1, gelu, ff2, drop2, add2, output],
        edges: [
          edge(input, ln1),
          edge(ln1, attn, 'out', 'query'),
          edge(ln1, attn, 'out', 'key'),
          edge(ln1, attn, 'out', 'value'),
          edge(attn, drop1),
          edge(drop1, add1, 'out', 'a'),
          edge(input, add1, 'out', 'b'),
          edge(add1, ln2),
          edge(ln2, ff1),
          edge(ff1, gelu),
          edge(gelu, ff2),
          edge(ff2, drop2),
          edge(drop2, add2, 'out', 'a'),
          edge(add1, add2, 'out', 'b'),
          edge(add2, output),
        ],
      };
    },
  },
  {
    id: 'autoencoder',
    name: 'Autoencoder',
    description: 'Simple autoencoder with encoder and decoder paths.',
    build: () => {
      const input = node('Input', 'input', 0, 200, { dims: 'null,784' });
      const enc1 = node('Linear', 'encoder_1', 250, 200, { in_features: 784, out_features: 256, bias: true });
      const relu1 = node('ReLU', 'relu_1', 500, 200);
      const enc2 = node('Linear', 'encoder_2', 700, 200, { in_features: 256, out_features: 64, bias: true });
      const relu2 = node('ReLU', 'relu_2', 950, 200);
      const dec1 = node('Linear', 'decoder_1', 1150, 200, { in_features: 64, out_features: 256, bias: true });
      const relu3 = node('ReLU', 'relu_3', 1400, 200);
      const dec2 = node('Linear', 'decoder_2', 1600, 200, { in_features: 256, out_features: 784, bias: true });
      const sig = node('Sigmoid', 'sigmoid_1', 1850, 200);
      const output = node('Output', 'output', 2100, 200);

      return {
        nodes: [input, enc1, relu1, enc2, relu2, dec1, relu3, dec2, sig, output],
        edges: [
          edge(input, enc1),
          edge(enc1, relu1),
          edge(relu1, enc2),
          edge(enc2, relu2),
          edge(relu2, dec1),
          edge(dec1, relu3),
          edge(relu3, dec2),
          edge(dec2, sig),
          edge(sig, output),
        ],
      };
    },
  },
  {
    id: 'rnn-classifier',
    name: 'LSTM Text Classifier',
    description: 'LSTM-based sequence classifier for text.',
    build: () => {
      const input = node('Input', 'input', 0, 200, { dims: 'null,128' });
      const emb = node('Embedding', 'embedding_1', 250, 200, { num_embeddings: 10000, embedding_dim: 256 });
      const lstm = node('LSTM', 'lstm_1', 500, 200, { input_size: 256, hidden_size: 128, num_layers: 2, bidirectional: false });
      const drop = node('Dropout', 'dropout_1', 750, 200, { p: 0.3 });
      const fc = node('Linear', 'fc1', 1000, 200, { in_features: 128, out_features: 5, bias: true });
      const output = node('Output', 'output', 1250, 200);

      return {
        nodes: [input, emb, lstm, drop, fc, output],
        edges: [
          edge(input, emb),
          edge(emb, lstm),
          edge(lstm, drop),
          edge(drop, fc),
          edge(fc, output),
        ],
      };
    },
  },
];
