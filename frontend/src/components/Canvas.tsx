import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useGraphStore, type BlockNode as BlockNodeType } from '../store/graphStore';
import { useUIStore } from '../store/uiStore';
import { useCustomBlockStore } from '../store/customBlockStore';
import BlockNode from './BlockNode';

const nodeTypes = {
  blockNode: BlockNode,
};

export default function Canvas() {
  const nodes = useGraphStore(s => s.nodes);
  const edges = useGraphStore(s => s.edges);
  const onNodesChange = useGraphStore(s => s.onNodesChange);
  const onEdgesChange = useGraphStore(s => s.onEdgesChange);
  const onConnect = useGraphStore(s => s.onConnect);
  const addNode = useGraphStore(s => s.addNode);
  const addCustomBlockPreset = useGraphStore(s => s.addCustomBlockPreset);

  const setSelectedNodeId = useUIStore(s => s.setSelectedNodeId);

  const reactFlowInstance = useRef<ReactFlowInstance<BlockNodeType> | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance<BlockNodeType>) => {
    reactFlowInstance.current = instance;
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const blockType = e.dataTransfer.getData('application/nodalab-block');
      const presetId = e.dataTransfer.getData('application/nodalab-custom-block');
      if ((!blockType && !presetId) || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      if (presetId) {
        const preset = useCustomBlockStore.getState().savedBlocks.find(block => block.id === presetId);
        if (preset) addCustomBlockPreset(preset, position);
      } else {
        addNode(blockType, position);
      }
    },
    [addNode, addCustomBlockPreset]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: BlockNodeType) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        style={{ background: 'var(--bg-primary)' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#2e3348"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as BlockNodeType['data'];
            const colors: Record<string, string> = {
              Input: '#8b5cf6',
              Output: '#8b5cf6',
              Linear: '#6366f1',
              Conv2d: '#6366f1',
              ReLU: '#22c55e',
              GELU: '#22c55e',
              Add: '#f59e0b',
              Concat: '#f59e0b',
              Dropout: '#ef4444',
            };
            return colors[data?.blockType] || '#6366f1';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}
