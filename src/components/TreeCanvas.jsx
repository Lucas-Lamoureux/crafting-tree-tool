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
import BoundaryNode from './BoundaryNode.jsx';
import ContextMenu from './ContextMenu.jsx';
import { deriveEdges, getDescendants } from '../logic/treeUtils.js';
import { getBoundaryRole, getConnectedTreeIds } from '../logic/boundaries.js';

const nodeTypes = {
  boundary: BoundaryNode,
  treeNode: TreeNode,
  textBlock: TextBlockNode,
};

const DEFAULT_TILE_WIDTH = 55;
const DEFAULT_TILE_HEIGHT = 32;
const TILE_LABEL_PADDING = 26;
const AVERAGE_CHARACTER_WIDTH = 7.4;
const EMPTY_BOUNDARY_WIDTH = 150;
const EMPTY_BOUNDARY_HEIGHT = 58;

function TreeCanvasInner({
  flowNodes,
  nodesById,
  collapsedIds,
  rootId,
  connectionSides,
  boundaries,
  boundaryLinks,
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
  onConnectBoundary,
  onDisconnectIngredient,
  onDisconnectBoundary,
  onAssignBoundary,
  onMoveBoundary,
  onDropTileIntoFrame,
  onCancelIngredientPick,
  pendingIngredientParentId,
  onViewportReady,
}) {
  const wrapperRef = useRef(null);
  const dragStateRef = useRef(null);
  const connectionStartRef = useRef(null);
  const connectionHandledRef = useRef(false);
  const connectionCleanupRef = useRef(null);

  const beginConnectorFallback = useCallback((id, side = null) => {
    connectionCleanupRef.current?.();
    connectionStartRef.current = { id, side };
    connectionHandledRef.current = false;

    let finished = false;
    const handleRelease = (event) => {
      if (finished) {
        return;
      }
      finished = true;

      const source = connectionStartRef.current;
      const sourceId = source?.id;
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
          onConnectIngredient(sourceId, targetId, source.side);
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
    const sourceSide = sourceHandle.getAttribute('data-side');

    if (sourceId) {
      beginConnectorFallback(sourceId, sourceSide);
    }
  }, [beginConnectorFallback]);

  const edges = useMemo(
    () => [
      ...deriveEdges(nodesById, collapsedIds, rootId, connectionSides),
      ...deriveBoundaryEdges(boundaryLinks, boundaries),
    ],
    [boundaries, boundaryLinks, nodesById, collapsedIds, rootId, connectionSides],
  );

  const boundaryRoles = useMemo(() => {
    const roles = {};

    (boundaries ?? []).forEach((boundary) => {
      const ids = getConnectedTreeIds(nodesById, boundary.rootId);

      ids.forEach((id) => {
        roles[id] ??= getBoundaryRole(nodesById, ids, id);
      });
    });

    return roles;
  }, [boundaries, nodesById]);

  const decoratedNodes = useMemo(
    () => flowNodes.map((node) => ({
      ...node,
      selected: selectedIds.has(node.id),
      data: {
        ...node.data,
        onToggleChecked,
        onUpdate: onUpdateTextBlock,
        boundaryRole: node.type === 'treeNode' ? boundaryRoles[node.id] : null,
        isIngredientPickerParent: node.id === pendingIngredientParentId,
        isIngredientPickerTarget: Boolean(
          pendingIngredientParentId && node.type === 'treeNode' && node.id !== pendingIngredientParentId,
        ),
      },
    })),
    [boundaryRoles, flowNodes, onToggleChecked, onUpdateTextBlock, pendingIngredientParentId, selectedIds],
  );

  const [localNodes, setLocalNodes] = useState(decoratedNodes);

  useEffect(() => {
    if (!dragStateRef.current) {
      setLocalNodes(decoratedNodes);
    }
  }, [decoratedNodes]);

  const boundaryNodes = useMemo(
    () => getBoundaryNodes(boundaries, localNodes, nodesById),
    [boundaries, localNodes, nodesById],
  );

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
    const boundary = node.type === 'boundary'
      ? (boundaries ?? []).find((item) => `boundary-${item.id}` === node.id)
      : (boundaries ?? []).find((item) => getConnectedTreeIds(nodesById, item.rootId).has(node.id));

    if (boundary) {
      getConnectedTreeIds(nodesById, boundary.rootId).forEach((id) => idsToMove.add(id));
    } else if (selectedGroup) {
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

    const basePositions = {
      [node.id]: { ...node.position },
    };

    localNodes.forEach((item) => {
      if (idsToMove.has(item.id)) {
        basePositions[item.id] = { ...item.position };
      }
    });

    dragStateRef.current = {
      draggedId: node.id,
      idsToMove,
      selectedGroup: selectedGroup || Boolean(boundary),
      basePositions,
    };
  }, [boundaries, collapsedIds, localNodes, nodesById, selectedIds]);

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

    if (node.type === 'treeNode' && !node.data?.isFrame) {
      const draggedElement = [...document.querySelectorAll('.react-flow__node')]
        .find((element) => element.getAttribute('data-id') === node.id);
      const draggedRect = draggedElement?.getBoundingClientRect();
      const centerX = draggedRect
        ? draggedRect.left + draggedRect.width / 2
        : node.position.x + (node.measured?.width ?? node.width ?? 55) / 2;
      const centerY = draggedRect
        ? draggedRect.top + draggedRect.height / 2
        : node.position.y + (node.measured?.height ?? node.height ?? 32) / 2;
      const middleSection = document.elementsFromPoint(centerX, centerY)
        .find((element) => element.classList?.contains('frame-section-middle'));
      const frameId = middleSection?.closest('.react-flow__node')?.getAttribute('data-id');

      if (frameId && frameId !== node.id) {
        onDropTileIntoFrame(node.id, frameId);
        dragStateRef.current = null;
        return;
      }
    }

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

    if (node.type === 'boundary' && dragState.idsToMove.size === 0) {
      onMoveBoundary(node.data.boundaryId, node.position);
      dragStateRef.current = null;
      return;
    }

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
  }, [onDropTileIntoFrame, onMoveBoundary, onMoveNodes, onMoveSubtree]);

  const handleNodeClick = useCallback((event, node) => {
    if (node.type === 'boundary') {
      return;
    }

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
    if (isBoundaryNodeId(connection.source) || isBoundaryNodeId(connection.target)) {
      onConnectBoundary(
        stripBoundaryNodeId(connection.source),
        stripBoundaryNodeId(connection.target),
        connection.sourceHandle,
        connection.targetHandle,
      );
      return;
    }

    onConnectIngredient(connection.source, connection.target, parseHandleSide(connection.sourceHandle));
  }, [onConnectBoundary, onConnectIngredient]);

  const handleConnectStart = useCallback((_, params) => {
    connectionStartRef.current = params?.handleType === 'source'
      ? { id: params.nodeId, side: parseHandleSide(params.handleId) }
      : null;
    connectionHandledRef.current = false;
  }, []);

  const handleConnectEnd = useCallback((event) => {
    const source = connectionStartRef.current;
    const sourceId = source?.id;

    if (!sourceId || connectionHandledRef.current || isBoundaryNodeId(sourceId)) {
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
        onConnectIngredient(sourceId, targetId, source.side);
      }

      connectionStartRef.current = null;
      connectionHandledRef.current = false;
    });
  }, [onConnectIngredient]);

  const handleEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();

    if (edge.id.startsWith('boundary-link:')) {
      onDisconnectBoundary(edge.id.replace(/^boundary-link:/, ''));
      return;
    }

    onDisconnectIngredient(edge.source, edge.target);
  }, [onDisconnectBoundary, onDisconnectIngredient]);

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
        nodes={[...boundaryNodes, ...localNodes]}
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
        hasBoundary={Boolean(
          contextMenu && (boundaries ?? []).some((boundary) => getConnectedTreeIds(nodesById, boundary.rootId).has(contextMenu.id)),
        )}
        onAction={onContextAction}
        onClose={onCloseContext}
        onDescriptionChange={onDescriptionChange}
      />
    </main>
  );
}

function parseHandleSide(handleId) {
  const side = String(handleId ?? '').replace(/^source-/, '').replace(/^target-/, '');

  return ['right', 'left', 'down', 'up'].includes(side) ? side : null;
}

function isBoundaryNodeId(id) {
  return String(id ?? '').startsWith('boundary-');
}

function stripBoundaryNodeId(id) {
  return String(id ?? '').replace(/^boundary-/, '');
}

function deriveBoundaryEdges(boundaryLinks = [], boundaries = []) {
  const boundaryIds = new Set((boundaries ?? []).map((boundary) => boundary.id));

  return (boundaryLinks ?? [])
    .filter((link) => boundaryIds.has(link.source) && boundaryIds.has(link.target))
    .map((link) => ({
      id: `boundary-link:${link.id}`,
      source: `boundary-${link.source}`,
      target: `boundary-${link.target}`,
      sourceHandle: link.sourceHandle,
      targetHandle: link.targetHandle,
      type: 'straight',
      animated: false,
      style: {
        stroke: '#f0c96c',
        strokeWidth: 2.2,
      },
    }));
}

function getBoundaryNodes(boundaries = []) {
  return boundaries.map((boundary) => ({
    id: `boundary-${boundary.id}`,
    type: 'boundary',
    position: boundary.position ?? { x: 120, y: 120 },
    data: {
      boundaryId: boundary.id,
      title: boundary.title ?? 'Frame',
    },
    style: {
      width: boundary.width ?? EMPTY_BOUNDARY_WIDTH,
      height: boundary.height ?? EMPTY_BOUNDARY_HEIGHT,
    },
    draggable: true,
    selectable: false,
    connectable: false,
    deletable: false,
    focusable: false,
    dragHandle: '.boundary-drag-handle',
    zIndex: 80,
  }));
}

function getNodeWidth(nodesById, id) {
  const node = nodesById[id];

  if (Number.isFinite(node?.width)) {
    return node.width;
  }

  return Math.max(
    DEFAULT_TILE_WIDTH,
    Math.ceil(String(id).length * AVERAGE_CHARACTER_WIDTH + TILE_LABEL_PADDING),
  );
}

function getNodeHeight(nodesById, id) {
  const node = nodesById[id];

  if (Number.isFinite(node?.height)) {
    return node.height;
  }

  return DEFAULT_TILE_HEIGHT;
}

export default function TreeCanvas(props) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
