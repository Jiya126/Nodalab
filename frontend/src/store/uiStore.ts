import { create } from 'zustand';

interface UIState {
  selectedNodeId: string | null;
  showBlockLibrary: boolean;
  showCodePreview: boolean;
  showPropertiesPanel: boolean;

  setSelectedNodeId: (id: string | null) => void;
  toggleBlockLibrary: () => void;
  toggleCodePreview: () => void;
  togglePropertiesPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  showBlockLibrary: true,
  showCodePreview: true,
  showPropertiesPanel: true,

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  toggleBlockLibrary: () => set((s) => ({ showBlockLibrary: !s.showBlockLibrary })),
  toggleCodePreview: () => set((s) => ({ showCodePreview: !s.showCodePreview })),
  togglePropertiesPanel: () => set((s) => ({ showPropertiesPanel: !s.showPropertiesPanel })),
}));
