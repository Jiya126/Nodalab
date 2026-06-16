import { create } from 'zustand';
import type { BlockNodeData } from '../blocks/types';

const STORAGE_KEY = 'nodalab-custom-block-presets';

export interface SavedCustomBlock {
  id: string;
  name: string;
  description: string;
  params: Pick<BlockNodeData, 'params'>['params'];
  createdAt: string;
  updatedAt: string;
}

interface CustomBlockState {
  savedBlocks: SavedCustomBlock[];
  saveCustomBlock: (block: Omit<SavedCustomBlock, 'id' | 'createdAt' | 'updatedAt'>) => SavedCustomBlock;
  deleteCustomBlock: (id: string) => void;
}

function readSavedBlocks(): SavedCustomBlock[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SavedCustomBlock[] : [];
  } catch {
    return [];
  }
}

function writeSavedBlocks(blocks: SavedCustomBlock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

function makeId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'custom-block';
  return `${slug}-${Date.now()}`;
}

export const useCustomBlockStore = create<CustomBlockState>((set, get) => ({
  savedBlocks: readSavedBlocks(),

  saveCustomBlock: (block) => {
    const now = new Date().toISOString();
    const existing = get().savedBlocks.find(
      saved => saved.name.trim().toLowerCase() === block.name.trim().toLowerCase()
    );

    const savedBlock: SavedCustomBlock = {
      id: existing?.id ?? makeId(block.name),
      name: block.name.trim(),
      description: block.description.trim(),
      params: JSON.parse(JSON.stringify(block.params)),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const nextBlocks = existing
      ? get().savedBlocks.map(saved => saved.id === existing.id ? savedBlock : saved)
      : [...get().savedBlocks, savedBlock];

    writeSavedBlocks(nextBlocks);
    set({ savedBlocks: nextBlocks });
    return savedBlock;
  },

  deleteCustomBlock: (id) => {
    const nextBlocks = get().savedBlocks.filter(block => block.id !== id);
    writeSavedBlocks(nextBlocks);
    set({ savedBlocks: nextBlocks });
  },
}));
