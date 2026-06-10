import type { BlockNode } from '../store/graphStore';
import { getBlockDefinition } from '../blocks/registry';

export interface ModelStats {
  totalParams: number;
  layerCount: number;
  blockCount: number;
}

function calcBlockParams(node: BlockNode): number {
  const def = getBlockDefinition(node.data.blockType);
  if (!def) return 0;

  const p = node.data.params;

  switch (node.data.blockType) {
    case 'Linear': {
      const inF = (p.in_features as number) || 0;
      const outF = (p.out_features as number) || 0;
      const bias = p.bias !== false;
      return inF * outF + (bias ? outF : 0);
    }
    case 'Conv2d': {
      const inC = (p.in_channels as number) || 0;
      const outC = (p.out_channels as number) || 0;
      const k = (p.kernel_size as number) || 1;
      return inC * outC * k * k + outC;
    }
    case 'Embedding': {
      const vocab = (p.num_embeddings as number) || 0;
      const dim = (p.embedding_dim as number) || 0;
      return vocab * dim;
    }
    case 'MultiHeadAttention': {
      const embed = (p.embed_dim as number) || 0;
      return 4 * embed * embed + 4 * embed;
    }
    case 'LayerNorm': {
      const ns = (p.normalized_shape as number) || 0;
      return 2 * ns;
    }
    case 'BatchNorm2d': {
      const nf = (p.num_features as number) || 0;
      return 2 * nf;
    }
    case 'LSTM': {
      const input = (p.input_size as number) || 0;
      const hidden = (p.hidden_size as number) || 0;
      const layers = (p.num_layers as number) || 1;
      const bidir = p.bidirectional ? 2 : 1;
      const firstLayer = 4 * hidden * (input + hidden + 2);
      const otherLayers = (layers - 1) * 4 * hidden * (hidden * bidir + hidden + 2);
      return bidir * (firstLayer + otherLayers);
    }
    default:
      return 0;
  }
}

export function calculateStats(nodes: BlockNode[]): ModelStats {
  let totalParams = 0;
  let layerCount = 0;

  for (const node of nodes) {
    const def = getBlockDefinition(node.data.blockType);
    if (!def) continue;

    const params = calcBlockParams(node);
    totalParams += params;

    if (def.category === 'layer') {
      layerCount++;
    }
  }

  return {
    totalParams,
    layerCount,
    blockCount: nodes.length,
  };
}

export function formatParamCount(n: number): string {
  if (n === 0) return '0';
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  return (n / 1_000_000_000).toFixed(2) + 'B';
}
