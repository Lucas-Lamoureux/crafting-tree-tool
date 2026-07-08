import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import TreeNode from './TreeNode.jsx';
import TextBlockNode from './TextBlockNode.jsx';
import ContextMenu from './ContextMenu.jsx';
import { deriveEdges, getDescendants } from '../logic/treeUtils.js';

const nodeTypes = {
  treeNode: TreeNode,
  textBlock: TextBlockNode,
};

function TreeCanvasInner({
  flowNodes,
  nodesById,
  collapsedIds,
  rootId,
  selectedId,
  selectedIds,
  contextMenu,
  onContextMenu,
  onContextAction,
  onDescriptionChange,
  onCloseContext,
  onSelect,
  onToggleChecked,
  onUpdateTextBlock,
  onMoveSubtree,
  onMoveNodes,
  onConnectIngredient,
  onDisconnectIngredient,
  onCancelIngredientPick,
  pendingIngredientParentId,
  onViewportReady,
}) {
  const wrapperRef = useRef(null);
  const dragStateRef = useRef(null);
  const connectionStartRef = useRef(null);
  const connectionHandledRef = useRef(false);
  const connectionCleanupRef = useRef(null);

  const beginConnectorFallback = useCallback((id) => {
    connectionCleanupRef.current?.();
    connectionStartRef.current = id;
    connectionHandledRef.current = false;

    let finished = false;
    const handleRelease = (event) => {
      if (finished) {
        return;
      }
      finished = true;

      const sourceId = connectionStartRef.current;
      const point = 'changedTouches' in event
        ? event.changedTouches[0]
        : event;

      window.setTimeout(() => {
        if (!sourceId || connectionHandledRef.current) {
          connectionStartRef.current = null;
          connectionHandledRef.current = false;
          return;
        }

        const targetNode = document
          .elementsFromPoint(point.clientX, point.clientY)
          .find((element) => element.classList?.contains('react-flow__node'));

        const targetId = targetNode?.getAttribute('data-id');

        if (targetId && targetId !== sourceId) {
          onConnectIngredient(sourceId, targetId);
        }

        connectionStartRef.current = null;
        connectionHandledRef.current = false;
      }, 50);
    };

    window.addEventListener('mouseup', handleRelease, { once: true });
    window.addEventListener('pointerup', handleRelease, { once: true });
    connectionCleanupRef.current = () => {
      window.removeEventListener('mouseup', handleRelease);
      window.removeEventListener('pointerup', handleRelease);
      connectionCleanupRef.current = null;
    };
  }, [onConnectIngredient]);

  useEffect(() => () => connectionCleanupRef.current?.(), []);

  const handleCanvasConnectorStart = useCallback((event) => {
    const sourceHandle = event.target.closest?.('.node-handle-out');

    if (!sourceHandle) {
      return;
    }

    const sourceNode = sourceHandle.closest('.react-flow__node');
    const sourceId = sourceNode?.getAttribute('data-id');

    if (sourceId) {
      beginConnectorFallback(sourceId);
    }
  }, [beginConnectorFallback]);

  const edges = useMemo(
    () => deriveEdges(nodesById, collapsedIds, rootId),
    [nodesById, collapsedIds, rootId],
  );

  const decoratedNodes = useMemo(
    () => flowNodes.map((node) => ({
      ...node,
      selected: selectedIds.has(node.id),
      data: {
        ...node.data,
        onToggleChecked,
        onUpdate: onUpdateTextBlock,
        isIngredientPickerParent: node.id === pendingIngredientParentId,
        isIngredientPickerTarget: Boolean(
          pendingIngredientParentId && node.type === 'treeNode' && node.id !== pendingIngredientParentId,
        ),
      },
    })),
    [flowNodes, onToggleChecked, onUpdateTextBlock, pendingIngredientParentId, selectedIds],
  );

  const [localNodes, setLocalNodes] = useState(decoratedNodes);

  useEffect(() => {
    if (!dragStateRef.current) {
      setLocalNodes(decoratedNodes);
    }
  }, [decoratedNodes]);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    onSelect(node.id, event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
    if (node.type !== 'treeNode') {
      onCloseContext();
      return;
    }
    onContextMenu({
      id: node.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, [onContextMenu, onSelect]);

  const handleNodeDragStart = useCallback((_, node) => {
    const selectedGroup = selectedIds.has(node.id) && selectedIds.size > 1;
    const idsToMove = new Set();

    if (selectedGroup) {
      selectedIds.forEach((id) => {
        idsToMove.add(id);

        if (nodesById[id]) {
          getDescendants(nodesById, id, collapsedIds).forEach((descendantId) => idsToMove.add(descendantId));
        }
      });
    } else {
      idsToMove.add(node.id);

      if (node.type === 'treeNode') {
        getDescendants(nodesById, node.id, collapsedIds).forEach((descendantId) => idsToMove.add(descendantId));
      }
    }

    const basePositions = {};

    localNodes.forEach((item) => {
      if (idsToMove.has(item.id)) {
        basePositions[item.id] = { ...item.position };
      }
    });

    dragStateRef.current = {
      draggedId: node.id,
      idsToMove,
      selectedGroup,
      basePositions,
    };
  }, [collapsedIds, localNodes, nodesById, selectedIds]);

  const handleNodeDrag = useCallback((_, node) => {
    const dragState = dragStateRef.current;
    const baseDraggedPosition = dragState?.basePositions[node.id];

    if (!dragState || !baseDraggedPosition) {
      return;
    }

    const delta = {
      x: node.position.x - baseDraggedPosition.x,
      y: node.position.y - baseDraggedPosition.y,
    };

    setLocalNodes((current) => current.map((item) => {
      const basePosition = dragState.basePositions[item.id];

      if (!basePosition || item.id === dragState.draggedId) {
        return item;
      }

      return {
        ...item,
        position: {
          x: basePosition.x + delta.x,
          y: basePosition.y + delta.y,
        },
      };
    }));
  }, []);

  const handleNodesChange = useCallback((changes) => {
    setLocalNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const handleNodeDragStop = useCallback((_, node) => {
    const dragState = dragStateRef.current;
    const baseDraggedPosition = dragState?.basePositions[node.id];

    if (!dragState || !baseDraggedPosition) {
      dragStateRef.current = null;
      return;
    }

    const delta = {
      x: node.position.x - baseDraggedPosition.x,
      y: node.position.y - baseDraggedPosition.y,
    };

    if (dragState.selectedGroup) {
      onMoveNodes(dragState.idsToMove, delta);
    } else {
      onMoveSubtree(
        dragState.draggedId,
        new Set([...dragState.idsToMove].filter((id) => id !== dragState.draggedId)),
        delta,
      );
    }
    dragStateRef.current = null;
  }, [onMoveNodes, onMoveSubtree]);

  const handleNodeClick = useCallback((event, node) => {
    if (pendingIngredientParentId) {
      if (node.type === 'treeNode') {
        onConnectIngredient(pendingIngredientParentId, node.id);
      }
      return;
    }

    onSelect(node.id, event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
  }, [onConnectIngredient, onSelect, pendingIngredientParentId]);

  const handleConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    connectionHandledRef.current = true;
    connectionStartRef.current = null;
    onConnectIngredient(connection.source, connection.target);
  }, [onConnectIngredient]);

  const handleConnectStart = useCallback((_, params) => {
    connectionStartRef.current = params?.handleType === 'source' ? params.nodeId : null;
    connectionHandledRef.current = false;
  }, []);

  const handleConnectEnd = useCallback((event) => {
    const sourceId = connectionStartRef.current;

    if (!sourceId || connectionHandledRef.current) {
      connectionStartRef.current = null;
      connectionHandledRef.current = false;
      return;
    }

    const point = 'changedTouches' in event
      ? event.changedTouches[0]
      : event;

    const clientPoint = {
      x: point.clientX,
      y: point.clientY,
    };

    window.requestAnimationFrame(() => {
      const targetNode = document
        .elementsFromPoint(clientPoint.x, clientPoint.y)
        .find((element) => element.classList?.contains('react-flow__node'));

      const targetId = targetNode?.getAttribute('data-id');

      if (targetId && targetId !== sourceId) {
        onConnectIngredient(sourceId, targetId);
      }

      connectionStartRef.current = null;
      connectionHandledRef.current = false;
    });
  }, [onConnectIngredient]);

  const handleEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    onDisconnectIngredient(edge.source, edge.target);
  }, [onDisconnectIngredient]);

  const handleInit = useCallback((instance) => {
    onViewportReady(instance);
    window.requestAnimationFrame(() => instance.fitView({ padding: 0.25, duration: 250 }));
  }, [onViewportReady]);

  return (
    <main
      className="canvas-shell"
      ref={wrapperRef}
      onMouseDownCapture={handleCanvasConnectorStart}
      onPointerDownCapture={handleCanvasConnectorStart}
    >
      <ReactFlow
        nodes={localNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={0.25}
        maxZoom={2.2}
        fitView
        connectionMode={ConnectionMode.Loose}
        connectionRadius={42}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        nodesDraggable
        nodesConnectable
        deleteKeyCode={null}
        onNodesChange={handleNodesChange}
        onInit={handleInit}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onPaneClick={() => {
          onCloseContext();
          onCancelIngredientPick();
          onSelect(null, 'replace');
        }}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <ContextMenu
        menu={contextMenu}
        node={contextMenu ? nodesById[contextMenu.id] : null}
        onAction={onContextAction}
        onClose={onCloseContext}
        onDescriptionChange={onDescriptionChange}
      />
    </main>
  );
}

export default function TreeCanvas(props) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
