import type { BlockDefinition } from './types';
import { inputBlock, outputBlock } from './definitions/special';
import { linearBlock, conv2dBlock, embeddingBlock, multiHeadAttentionBlock, layerNormBlock, batchNorm2dBlock, lstmBlock } from './definitions/layers';
import { reluBlock, geluBlock, softmaxBlock, sigmoidBlock } from './definitions/activations';
import { addBlock, concatBlock, reshapeBlock, flattenBlock } from './definitions/operations';
import { dropoutBlock } from './definitions/regularization';
import { customBlock } from './definitions/custom';

const blockDefinitions: Map<string, BlockDefinition> = new Map();

function register(def: BlockDefinition) {
  blockDefinitions.set(def.type, def);
}

register(inputBlock);
register(outputBlock);

register(linearBlock);
register(conv2dBlock);
register(embeddingBlock);
register(multiHeadAttentionBlock);
register(layerNormBlock);
register(batchNorm2dBlock);
register(lstmBlock);

register(reluBlock);
register(geluBlock);
register(softmaxBlock);
register(sigmoidBlock);

register(addBlock);
register(concatBlock);
register(reshapeBlock);
register(flattenBlock);

register(dropoutBlock);

register(customBlock);

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return blockDefinitions.get(type);
}

export function getAllBlockDefinitions(): BlockDefinition[] {
  return Array.from(blockDefinitions.values());
}

export function getBlocksByCategory(category: BlockDefinition['category']): BlockDefinition[] {
  return getAllBlockDefinitions().filter(b => b.category === category);
}

export const CATEGORIES: { key: BlockDefinition['category']; label: string }[] = [
  { key: 'special', label: 'Special' },
  { key: 'layer', label: 'Layers' },
  { key: 'activation', label: 'Activations' },
  { key: 'operation', label: 'Operations' },
  { key: 'regularization', label: 'Regularization' },
  { key: 'pooling', label: 'Pooling' },
];
