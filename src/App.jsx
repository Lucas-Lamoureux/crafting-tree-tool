import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TreeCanvas from './components/TreeCanvas.jsx';
import Toolbar from './components/Toolbar.jsx';
import PropertyPanel from './components/PropertyPanel.jsx';
import AddTileModal from './components/AddTileModal.jsx';
import AddIngredientsModal from './components/AddIngredientsModal.jsx';
import BlockModal from './components/BlockModal.jsx';
import SaveProjectModal from './components/SaveProjectModal.jsx';
import { initialTree } from './data/initialTree.js';
import { layoutSubtreePositions, layoutTree } from './logic/treeLayout.js';
import {
  addIngredient,
  addNode,
  deleteNode,
  deleteNodes,
  getDescendants,
  normalizeId,
  removeIngredient,
  renameNode,
  updateDescription,
} from './logic/treeUtils.js';
import { downloadJson, parseProject, serializeProject } from './logic/saveLoad.js';
import { getConnectedTreeIds } from './logic/boundaries.js';

function initialNodesById() {
  return Object.fromEntries(
    Object.values(initialTree.nodes).map((node) => [
      node.id,
      { id: node.id, description: node.description ?? '', ingredients: [...node.ingredients] },
    ]),
  );
}

function removeConnectionSide(connectionSides, parentId, childId) {
  const parentSides = connectionSides[parentId];

  if (!parentSides?.[childId]) {
    return connectionSides;
  }

  const nextParentSides = { ...parentSides };
  delete nextParentSides[childId];

  if (Object.keys(nextParentSides).length === 0) {
    const { [parentId]: _removed, ...rest } = connectionSides;
    return rest;
  }

  return {
    ...connectionSides,
    [parentId]: nextParentSides,
  };
}

function removeNodeConnectionSides(connectionSides, nodeId) {
  const next = {};

  Object.entries(connectionSides).forEach(([parentId, children]) => {
    if (parentId === nodeId) {
      return;
    }

    const keptChildren = Object.fromEntries(
      Object.entries(children ?? {}).filter(([childId]) => childId !== nodeId),
    );

    if (Object.keys(keptChildren).length > 0) {
      next[parentId] = keptChildren;
    }
  });

  return next;
}

function renameConnectionSideNode(connectionSides, oldId, newId) {
  const next = {};

  Object.entries(connectionSides).forEach(([parentId, children]) => {
    const nextParentId = parentId === oldId ? newId : parentId;
    const nextChildren = {};

    Object.entries(children ?? {}).forEach(([childId, side]) => {
      nextChildren[childId === oldId ? newId : childId] = side;
    });

    next[nextParentId] = nextChildren;
  });

  return next;
}

const DEFAULT_TILE_WIDTH = 55;
const DEFAULT_TILE_HEIGHT = 32;
const TIER_GAP = 50;
const SIDE_ROOT_GAP = 4;
const TILE_LABEL_PADDING = 26;
const AVERAGE_CHARACTER_WIDTH = 7.4;

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

function getConnectionAnchor(parentId, childId, side, flowNodes, nodesById) {
  const parentFlowNode = flowNodes.find((node) => node.id === parentId);
  const parentPosition = parentFlowNode?.position ?? { x: 0, y: 0 };
  const parentWidth = getNodeWidth(nodesById, parentId);
  const parentHeight = getNodeHeight(nodesById, parentId);
  const childWidth = getNodeWidth(nodesById, childId);
  const childHeight = getNodeHeight(nodesById, childId);

  if (side === 'left') {
    return {
      x: parentPosition.x - TIER_GAP - childWidth,
      y: parentPosition.y + parentHeight / 2 - childHeight / 2,
    };
  }

  if (side === 'up') {
    return {
      x: parentPosition.x + parentWidth / 2 - childWidth / 2,
      y: parentPosition.y - TIER_GAP - childHeight,
    };
  }

  if (side === 'down') {
    return {
      x: parentPosition.x + parentWidth / 2 - childWidth / 2,
      y: parentPosition.y + parentHeight + TIER_GAP,
    };
  }

  return {
    x: parentPosition.x + parentWidth + TIER_GAP,
    y: parentPosition.y + parentHeight / 2 - childHeight / 2,
  };
}

function getBlockSideAnchors(blockId, childSides, flowNodes, nodesById) {
  const blockFlowNode = flowNodes.find((node) => node.id === blockId);
  const blockPosition = blockFlowNode?.position ?? { x: 0, y: 0 };
  const blockWidth = getNodeWidth(nodesById, blockId);
  const blockHeight = getNodeHeight(nodesById, blockId);
  const anchors = {};

  ['right', 'left'].forEach((side) => {
    const childIds = childSides[side] ?? [];
    const totalHeight = childIds.reduce(
      (total, childId, index) => total + getNodeHeight(nodesById, childId) + (index > 0 ? SIDE_ROOT_GAP : 0),
      0,
    );
    let y = blockPosition.y + blockHeight / 2 - totalHeight / 2;

    childIds.forEach((childId) => {
      const childWidth = getNodeWidth(nodesById, childId);
      const childHeight = getNodeHeight(nodesById, childId);

      anchors[childId] = {
        x: side === 'left'
          ? blockPosition.x - TIER_GAP - childWidth
          : blockPosition.x + blockWidth + TIER_GAP,
        y,
      };
      y += childHeight + SIDE_ROOT_GAP;
    });
  });

  ['up', 'down'].forEach((side) => {
    const childIds = childSides[side] ?? [];
    const totalWidth = childIds.reduce(
      (total, childId, index) => total + getNodeWidth(nodesById, childId) + (index > 0 ? SIDE_ROOT_GAP : 0),
      0,
    );
    let x = blockPosition.x + blockWidth / 2 - totalWidth / 2;

    childIds.forEach((childId) => {
      const childHeight = getNodeHeight(nodesById, childId);

      anchors[childId] = {
        x,
        y: side === 'up'
          ? blockPosition.y - TIER_GAP - childHeight
          : blockPosition.y + blockHeight + TIER_GAP,
      };
      x += getNodeWidth(nodesById, childId) + SIDE_ROOT_GAP;
    });
  });

  return anchors;
}

function getUniqueImportId(rawId, usedIds) {
  const baseId = normalizeId(rawId) || 'imported';

  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let index = 2;
  let nextId = `${baseId}_${index}`;

  while (usedIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}_${index}`;
  }

  usedIds.add(nextId);
  return nextId;
}

function getUniqueBoundaryId(boundaries) {
  const usedIds = new Set(boundaries.map((boundary) => boundary.id));
  let index = boundaries.length + 1;
  let id = `boundary-${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `boundary-${index}`;
  }

  return id;
}

function getBoundaryForNode(boundaries, nodesById, nodeId) {
  return boundaries.find((boundary) => getConnectedTreeIds(nodesById, boundary.rootId).has(nodeId)) ?? null;
}

function remapBoundariesForImport(boundaries = [], nodeIdMap = {}) {
  return boundaries
    .filter((boundary) => nodeIdMap[boundary.rootId])
    .map((boundary) => ({
      ...boundary,
      id: `import-${boundary.id}`,
      rootId: nodeIdMap[boundary.rootId],
    }));
}

function getNodePositionsForProject(project) {
  const laidOutNodes = layoutTree(
    project.nodesById,
    project.rootId,
    new Set(project.collapsedIds ?? []),
    project.positions ?? {},
    project.treeDirections?.[project.rootId] ?? 'right',
  );

  return Object.fromEntries(laidOutNodes.map((node) => [node.id, node.position]));
}

function getPositionBounds(entries) {
  if (entries.length === 0) {
    return null;
  }

  return entries.reduce((bounds, entry) => ({
    minX: Math.min(bounds.minX, entry.x),
    minY: Math.min(bounds.minY, entry.y),
    maxX: Math.max(bounds.maxX, entry.x + entry.width),
    maxY: Math.max(bounds.maxY, entry.y + entry.height),
  }), {
    minX: entries[0].x,
    minY: entries[0].y,
    maxX: entries[0].x + entries[0].width,
    maxY: entries[0].y + entries[0].height,
  });
}

function getCanvasBounds(flowNodes, nodesById, textBlocks) {
  return getPositionBounds(flowNodes.map((node) => {
    const textBlock = textBlocks[node.id];

    return {
      x: node.position.x,
      y: node.position.y,
      width: textBlock?.width ?? getNodeWidth(nodesById, node.id),
      height: textBlock?.height ?? getNodeHeight(nodesById, node.id),
    };
  }));
}

function remapProjectForImport(project, currentState) {
  const { nodesById, textBlocks, flowNodes, boundaries } = currentState;
  const usedIds = new Set([...Object.keys(nodesById), ...Object.keys(textBlocks)]);
  const usedBoundaryIds = new Set((boundaries ?? []).map((boundary) => boundary.id));
  const nodeIdMap = {};
  const textIdMap = {};
  let renamedCount = 0;

  Object.keys(project.nodesById).forEach((oldId) => {
    const newId = getUniqueImportId(oldId, usedIds);
    nodeIdMap[oldId] = newId;

    if (newId !== oldId) {
      renamedCount += 1;
    }
  });

  Object.keys(project.textBlocks ?? {}).forEach((oldId) => {
    const newId = getUniqueImportId(oldId, usedIds);
    textIdMap[oldId] = newId;

    if (newId !== oldId) {
      renamedCount += 1;
    }
  });

  const importedNodesById = Object.fromEntries(
    Object.entries(project.nodesById).map(([oldId, node]) => [
      nodeIdMap[oldId],
      {
        ...node,
        id: nodeIdMap[oldId],
        ingredients: node.ingredients.map((ingredientId) => nodeIdMap[ingredientId]).filter(Boolean),
      },
    ]),
  );
  const importedTextBlocks = Object.fromEntries(
    Object.entries(project.textBlocks ?? {}).map(([oldId, block]) => [
      textIdMap[oldId],
      {
        ...block,
        id: textIdMap[oldId],
      },
    ]),
  );
  const importedTreeDirections = Object.fromEntries(
    Object.entries(project.treeDirections ?? {})
      .filter(([oldId]) => nodeIdMap[oldId])
      .map(([oldId, direction]) => [nodeIdMap[oldId], direction]),
  );
  const importedConnectionSides = {};
  const importedBoundaries = remapBoundariesForImport(project.boundaries, nodeIdMap).map((boundary) => {
    let nextId = boundary.id;
    let index = 2;

    while (usedBoundaryIds.has(nextId)) {
      nextId = `${boundary.id}_${index}`;
      index += 1;
    }

    usedBoundaryIds.add(nextId);

    return {
      ...boundary,
      id: nextId,
    };
  });

  Object.entries(project.connectionSides ?? {}).forEach(([oldParentId, children]) => {
    const parentId = nodeIdMap[oldParentId];

    if (!parentId) {
      return;
    }

    Object.entries(children ?? {}).forEach(([oldChildId, side]) => {
      const childId = nodeIdMap[oldChildId];

      if (childId) {
        importedConnectionSides[parentId] ??= {};
        importedConnectionSides[parentId][childId] = side;
      }
    });
  });

  const baseProjectPositions = getNodePositionsForProject({
    ...project,
    nodesById: importedNodesById,
    rootId: nodeIdMap[project.rootId] ?? Object.keys(importedNodesById)[0] ?? null,
    collapsedIds: (project.collapsedIds ?? []).map((id) => nodeIdMap[id]).filter(Boolean),
    positions: Object.fromEntries(
      Object.entries(project.positions ?? {})
        .filter(([oldId]) => nodeIdMap[oldId])
        .map(([oldId, position]) => [nodeIdMap[oldId], position]),
    ),
    treeDirections: importedTreeDirections,
  });
  const baseTextPositions = Object.fromEntries(
    Object.values(importedTextBlocks).map((block) => [block.id, block.position ?? { x: 40, y: 40 }]),
  );
  const currentBounds = getCanvasBounds(flowNodes, nodesById, textBlocks);
  const importedBounds = getPositionBounds([
    ...Object.entries(baseProjectPositions).map(([id, position]) => ({
      x: position.x,
      y: position.y,
      width: getNodeWidth(importedNodesById, id),
      height: getNodeHeight(importedNodesById, id),
    })),
    ...Object.values(importedTextBlocks).map((block) => ({
      x: baseTextPositions[block.id]?.x ?? 40,
      y: baseTextPositions[block.id]?.y ?? 40,
      width: block.width,
      height: block.height,
    })),
  ]);
  const offset = currentBounds && importedBounds
    ? {
      x: currentBounds.maxX + 160 - importedBounds.minX,
      y: currentBounds.minY - importedBounds.minY,
    }
    : { x: 0, y: 0 };
  const importedPositions = Object.fromEntries(
    Object.entries(baseProjectPositions).map(([id, position]) => [
      id,
      {
        x: position.x + offset.x,
        y: position.y + offset.y,
      },
    ]),
  );
  const positionedTextBlocks = Object.fromEntries(
    Object.entries(importedTextBlocks).map(([id, block]) => {
      const position = baseTextPositions[id] ?? { x: 40, y: 40 };

      return [
        id,
        {
          ...block,
          position: {
            x: position.x + offset.x,
            y: position.y + offset.y,
          },
        },
      ];
    }),
  );

  return {
    nodesById: importedNodesById,
    textBlocks: positionedTextBlocks,
    rootId: nodeIdMap[project.rootId] ?? Object.keys(importedNodesById)[0] ?? null,
    checkedIds: (project.checkedIds ?? []).map((id) => nodeIdMap[id]).filter(Boolean),
    collapsedIds: (project.collapsedIds ?? []).map((id) => nodeIdMap[id]).filter(Boolean),
    positions: importedPositions,
    treeDirections: importedTreeDirections,
    connectionSides: importedConnectionSides,
    boundaries: importedBoundaries,
    renamedCount,
  };
}

export default function App() {
  const [nodesById, setNodesById] = useState(initialNodesById);
  const [textBlocks, setTextBlocks] = useState({});
  const [rootId, setRootId] = useState(initialTree.rootId);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [manualPositions, setManualPositions] = useState({});
  const [treeDirections, setTreeDirections] = useState({});
  const [connectionSides, setConnectionSides] = useState({});
  const [boundaries, setBoundaries] = useState([]);
  const [selectedId, setSelectedId] = useState(initialTree.rootId);
  const [selectedIds, setSelectedIds] = useState(() => new Set([initialTree.rootId]));
  const [pendingIngredientParentId, setPendingIngredientParentId] = useState(null);
  const [ingredientModalParentId, setIngredientModalParentId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [addTileModalOpen, setAddTileModalOpen] = useState(false);
  const [blockModal, setBlockModal] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [message, setMessage] = useState('Ready');
  const flowRef = useRef(null);
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const directionByNode = useMemo(() => {
    const next = {};

    Object.entries(treeDirections).forEach(([treeRootId, direction]) => {
      if (!nodesById[treeRootId]) {
        return;
      }

      next[treeRootId] = direction;
      getDescendants(nodesById, treeRootId, collapsedIds).forEach((id) => {
        next[id] = direction;
      });
    });

    Object.entries(connectionSides).forEach(([parentId, children]) => {
      if (!nodesById[parentId]?.isBlock) {
        return;
      }

      Object.entries(children ?? {}).forEach(([childId, side]) => {
        if (!nodesById[childId]) {
          return;
        }

        next[childId] = side;
        getDescendants(nodesById, childId, collapsedIds).forEach((id) => {
          next[id] = side;
        });
      });
    });

    return next;
  }, [collapsedIds, connectionSides, nodesById, treeDirections]);

  const flowNodes = useMemo(() => {
    const rootDirection = treeDirections[rootId] ?? 'right';
    const laidOutNodes = layoutTree(nodesById, rootId, collapsedIds, manualPositions, rootDirection);

    const treeNodes = laidOutNodes.map((node) => {
      const ingredients = nodesById[node.id]?.ingredients ?? [];
      const checkedIngredientCount = ingredients.filter((ingredientId) => checkedIds.has(ingredientId)).length;
      let ingredientCheckStatus = 'none';

      if (ingredients.length > 0) {
        if (checkedIngredientCount === ingredients.length) {
          ingredientCheckStatus = 'all';
        } else if (checkedIngredientCount > 0) {
          ingredientCheckStatus = 'partial';
        }
      }

      return {
        ...node,
        data: {
          ...node.data,
          checked: checkedIds.has(node.id),
          selected: selectedIds.has(node.id),
          ingredientCheckStatus,
          layoutDirection: directionByNode[node.id] ?? 'right',
          isBlock: Boolean(nodesById[node.id]?.isBlock),
          width: nodesById[node.id]?.width,
          height: nodesById[node.id]?.height,
        },
      };
    });

    const textBlockNodes = Object.values(textBlocks).map((block) => ({
      id: block.id,
      type: 'textBlock',
      position: manualPositions[block.id] ?? block.position,
      data: {
        ...block,
        selected: selectedIds.has(block.id),
      },
      draggable: true,
    }));

    return [...treeNodes, ...textBlockNodes];
  },
    [checkedIds, collapsedIds, directionByNode, manualPositions, nodesById, rootId, selectedIds, textBlocks, treeDirections],
  );

  const edgeCount = useMemo(
    () => Object.values(nodesById).reduce((total, node) => total + node.ingredients.length, 0),
    [nodesById],
  );

  useEffect(() => {
    setBoundaries((current) => current.filter((boundary) => nodesById[boundary.rootId]));
  }, [nodesById]);

  const setResult = useCallback((result, successMessage, options = {}) => {
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }

    if (options.preservePositions) {
      setManualPositions((current) => {
        const next = { ...current };

        flowNodes.forEach((node) => {
          if (result.nodesById?.[node.id]) {
            next[node.id] = { ...node.position };
          }
        });

        return next;
      });
    }

    setNodesById(result.nodesById);
    if (result.rootId !== undefined) {
      setRootId(result.rootId);
    }
    setMessage(successMessage);
    return true;
  }, [flowNodes]);

  const connectIngredient = useCallback((parentId, ingredientId, side = null) => {
    if (!nodesById[parentId] || !nodesById[ingredientId]) {
      setMessage('Text blocks cannot be connected.');
      return;
    }

    if (nodesById[parentId]?.ingredients.includes(ingredientId)) {
      const result = removeIngredient(nodesById, parentId, ingredientId);
      if (setResult(result, `Removed ${ingredientId} from ${parentId}.`, { preservePositions: true })) {
        setConnectionSides((current) => removeConnectionSide(current, parentId, ingredientId));
        setSelectedId(parentId);
        setPendingIngredientParentId(null);
      }
      return;
    }

    const result = addIngredient(nodesById, parentId, ingredientId);

    if (setResult(result, `Added ${ingredientId} to ${parentId}.`)) {
      if (nodesById[parentId]?.isBlock && side) {
        setConnectionSides((current) => ({
          ...current,
          [parentId]: {
            ...(current[parentId] ?? {}),
            [ingredientId]: side,
          },
        }));
        setTreeDirections((current) => ({
          ...current,
          [ingredientId]: side,
        }));
        setManualPositions((current) => ({
          ...current,
          ...layoutSubtreePositions(
            result.nodesById,
            ingredientId,
            collapsedIds,
            side,
            getConnectionAnchor(parentId, ingredientId, side, flowNodes, nodesById),
          ),
        }));
      }
      setSelectedId(ingredientId);
      setPendingIngredientParentId(null);
    }
  }, [collapsedIds, flowNodes, nodesById, setResult]);

  const disconnectIngredient = useCallback((parentId, ingredientId) => {
    if (setResult(
      removeIngredient(nodesById, parentId, ingredientId),
      `Removed ${ingredientId} from ${parentId}.`,
      { preservePositions: true },
    )) {
      setConnectionSides((current) => removeConnectionSide(current, parentId, ingredientId));
    }
  }, [nodesById, setResult]);

  const removeNodeById = useCallback((id) => {
    if (textBlocks[id]) {
      setTextBlocks((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setSelectedId(null);
      setSelectedIds(new Set());
      setManualPositions((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setTreeDirections((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setConnectionSides((current) => removeNodeConnectionSides(current, id));
      setMessage(`Deleted ${id}.`);
      return;
    }

    const result = deleteNode(nodesById, id, rootId);
    if (setResult(result, `Deleted ${id}.`, { preservePositions: true })) {
      setSelectedId((current) => (current === id ? result.rootId ?? null : current));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);

        if (next.size === 0 && result.rootId) {
          next.add(result.rootId);
        }

        return next;
      });
      setCollapsedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setManualPositions((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setTreeDirections((current) => {
        const { [id]: _removed, ...rest } = current;
        return rest;
      });
      setConnectionSides((current) => removeNodeConnectionSides(current, id));
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }, [nodesById, rootId, setResult, textBlocks]);

  const removeNodesByIds = useCallback((ids) => {
    const idsToDelete = [...new Set(ids)].filter((id) => nodesById[id]);
    const textIdsToDelete = [...new Set(ids)].filter((id) => textBlocks[id]);

    if (idsToDelete.length === 0 && textIdsToDelete.length === 0) {
      return;
    }

    if (textIdsToDelete.length > 0) {
      setTextBlocks((current) => {
        const next = { ...current };
        textIdsToDelete.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }

    const labelCount = idsToDelete.length + textIdsToDelete.length;
    const label = labelCount === 1 ? [...idsToDelete, ...textIdsToDelete][0] : `${labelCount} items`;

    if (idsToDelete.length === 0) {
      const deletedIds = new Set(textIdsToDelete);
      setSelectedId(null);
      setSelectedIds(new Set());
      setManualPositions((current) => {
        const next = { ...current };
        deletedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setTreeDirections((current) => {
        const next = { ...current };
        deletedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setConnectionSides((current) => {
        let next = current;
        deletedIds.forEach((id) => {
          next = removeNodeConnectionSides(next, id);
        });
        return next;
      });
      setMessage(`Deleted ${label}.`);
      return;
    }

    const result = deleteNodes(nodesById, idsToDelete, rootId);

    if (setResult(result, `Deleted ${label}.`, { preservePositions: true })) {
      const deletedIds = new Set([...result.deletedIds, ...textIdsToDelete]);
      const nextSelectedId = deletedIds.has(selectedId) ? result.rootId ?? null : selectedId;

      setSelectedId(nextSelectedId);
      setSelectedIds(nextSelectedId ? new Set([nextSelectedId]) : new Set());
      setCollapsedIds((current) => {
        const next = new Set(current);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setManualPositions((current) => {
        const next = { ...current };
        deletedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setTreeDirections((current) => {
        const next = { ...current };
        deletedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setConnectionSides((current) => {
        let next = current;
        deletedIds.forEach((id) => {
          next = removeNodeConnectionSides(next, id);
        });
        return next;
      });
      setCheckedIds((current) => {
        const next = new Set(current);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [nodesById, rootId, selectedId, setResult, textBlocks]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setPendingIngredientParentId(null);
        setIngredientModalParentId(null);
        setAddTileModalOpen(false);
        setBlockModal(null);
        setSaveModalOpen(false);
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        const target = event.target;
        const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;

        if (!isEditing) {
          event.preventDefault();
          removeNodesByIds(selectedIds);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeNodesByIds, selectedId, selectedIds]);

  const handleContextAction = useCallback((action) => {
    const id = contextMenu?.id;

    if (!id) {
      return;
    }

    const relayoutTree = (treeRootId, direction) => {
      const anchor = flowNodes.find((node) => node.id === treeRootId)?.position
        ?? manualPositions[treeRootId]
        ?? { x: 0, y: 0 };
      const positions = layoutSubtreePositions(nodesById, treeRootId, collapsedIds, direction, anchor);

      setManualPositions((current) => ({
        ...current,
        ...positions,
      }));
    };

    const relayoutBlockTrees = (blockId) => {
      const block = nodesById[blockId];

      if (!block?.isBlock) {
        return false;
      }

      const nextPositions = {};
      const nextDirections = {};
      const childSides = {
        right: [],
        left: [],
        up: [],
        down: [],
      };

      block.ingredients.forEach((childId) => {
        if (!nodesById[childId]) {
          return;
        }

        const side = connectionSides[blockId]?.[childId]
          ?? treeDirections[childId]
          ?? directionByNode[childId]
          ?? 'right';

        nextDirections[childId] = side;
        childSides[side]?.push(childId);
      });

      const sideAnchors = getBlockSideAnchors(blockId, childSides, flowNodes, nodesById);

      block.ingredients.forEach((childId) => {
        if (!nodesById[childId]) {
          return;
        }

        const side = nextDirections[childId] ?? 'right';
        Object.assign(
          nextPositions,
          layoutSubtreePositions(
            nodesById,
            childId,
            collapsedIds,
            side,
            sideAnchors[childId] ?? getConnectionAnchor(blockId, childId, side, flowNodes, nodesById),
          ),
        );
      });

      setTreeDirections((current) => ({
        ...current,
        ...nextDirections,
      }));
      setManualPositions((current) => ({
        ...current,
        ...nextPositions,
      }));

      return true;
    };

    if (action === 'add') {
      setPendingIngredientParentId(id);
      setMessage(`Click an existing ID to add it as an ingredient of ${id}.`);
    }

    if (action === 'add-ingredients') {
      setIngredientModalParentId(id);
      setMessage(`Adding ingredients to ${id}.`);
    }

    if (action === 'remove') {
      const ingredientId = normalizeId(window.prompt(`Remove which ingredient from ${id}?`));
      if (!ingredientId) return;
      if (setResult(
        removeIngredient(nodesById, id, ingredientId),
        `Removed ${ingredientId} from ${id}.`,
        { preservePositions: true },
      )) {
        setConnectionSides((current) => removeConnectionSide(current, id, ingredientId));
      }
    }

    if (action === 'resize-block') {
      const node = nodesById[id];

      if (node?.isBlock) {
        setBlockModal({
          mode: 'edit',
          id,
        });
      }
    }

    if (action.startsWith('direction-')) {
      const direction = action.replace('direction-', '');

      setTreeDirections((current) => ({
        ...current,
        [id]: direction,
      }));
      relayoutTree(id, direction);
      setMessage(`${id} tree now grows ${direction}.`);
    }

    if (action === 'auto-layout') {
      if (relayoutBlockTrees(id)) {
        setMessage(`Auto-layout rebuilt ${id}'s connected trees.`);
      } else {
        const direction = treeDirections[id] ?? directionByNode[id] ?? 'right';

        relayoutTree(id, direction);
        setMessage(`Auto-layout rebuilt ${id}'s tree.`);
      }
    }

    if (action === 'add-boundary') {
      setBoundaries((current) => {
        const existingBoundary = getBoundaryForNode(current, nodesById, id);

        if (existingBoundary) {
          return current;
        }

        return [
          ...current,
          {
            id: getUniqueBoundaryId(current),
            rootId: id,
            title: `${id} boundary`,
          },
        ];
      });
      setMessage(`Created a boundary around ${id}'s connected tree.`);
    }

    if (action === 'remove-boundary') {
      setBoundaries((current) => {
        const boundary = getBoundaryForNode(current, nodesById, id);

        if (!boundary) {
          return current;
        }

        return current.filter((item) => item.id !== boundary.id);
      });
      setMessage(`Removed ${id}'s connected tree boundary.`);
    }

    if (action === 'rename') {
      const nextId = normalizeId(window.prompt(`Rename ${id} to:`, id));
      if (!nextId || nextId === id) return;
      const result = renameNode(nodesById, id, nextId, rootId);
      if (setResult(result, `Renamed ${id} to ${nextId}.`)) {
        setSelectedId(nextId);
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.delete(id)) {
            next.add(nextId);
          }
          return next;
        });
        setCollapsedIds((current) => {
          const next = new Set(current);
          if (next.delete(id)) {
            next.add(nextId);
          }
          return next;
        });
        setManualPositions((current) => {
          const { [id]: oldPosition, ...rest } = current;
          return oldPosition ? { ...rest, [nextId]: oldPosition } : rest;
        });
        setTreeDirections((current) => {
          const { [id]: oldDirection, ...rest } = current;
          return oldDirection ? { ...rest, [nextId]: oldDirection } : rest;
        });
        setBoundaries((current) => current.map((boundary) => (
          boundary.rootId === id ? { ...boundary, rootId: nextId, title: `${nextId} boundary` } : boundary
        )));
        setConnectionSides((current) => renameConnectionSideNode(current, id, nextId));
        setCheckedIds((current) => {
          const next = new Set(current);
          if (next.delete(id)) {
            next.add(nextId);
          }
          return next;
        });
      }
    }

    if (action === 'delete') {
      const idsToDelete = selectedIds.has(id) ? selectedIds : new Set([id]);
      const label = idsToDelete.size === 1 ? id : `${idsToDelete.size} highlighted tiles`;

      if (window.confirm(`Delete ${label}? References to them will be removed.`)) {
        removeNodesByIds(idsToDelete);
      }
    }

    setContextMenu(null);
  }, [
    collapsedIds,
    connectionSides,
    contextMenu,
    directionByNode,
    flowNodes,
    manualPositions,
    nodesById,
    removeNodeById,
    removeNodesByIds,
    rootId,
    selectedIds,
    setResult,
    treeDirections,
  ]);

  const handleAddNode = useCallback(() => {
    setAddTileModalOpen(true);
  }, []);

  const handleCreateNode = useCallback((value) => {
    const id = normalizeId(value);
    const result = addNode(nodesById, id);

    if (setResult(result, `Added tile ${id}.`)) {
      setSelectedId(id);
      setSelectedIds(new Set([id]));
      setRootId((current) => current ?? id);
      setAddTileModalOpen(false);
    }
  }, [nodesById, setResult]);

  const handleCreateIngredients = useCallback((parentId, ingredientIds) => {
    let nextNodesById = nodesById;

    for (const ingredientId of ingredientIds) {
      const result = addIngredient(nextNodesById, parentId, ingredientId);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      nextNodesById = result.nodesById;
    }

    const direction = treeDirections[parentId] ?? directionByNode[parentId] ?? 'right';
    const anchor = flowNodes.find((node) => node.id === parentId)?.position
      ?? manualPositions[parentId]
      ?? { x: 0, y: 0 };
    const positions = layoutSubtreePositions(nextNodesById, parentId, collapsedIds, direction, anchor);

    setNodesById(nextNodesById);
    setManualPositions((current) => ({
      ...current,
      ...positions,
    }));
    setSelectedId(parentId);
    setSelectedIds(new Set([parentId]));
    setIngredientModalParentId(null);
    setMessage(`Added ${ingredientIds.length} ingredient${ingredientIds.length === 1 ? '' : 's'} to ${parentId}.`);
  }, [collapsedIds, directionByNode, flowNodes, manualPositions, nodesById, treeDirections]);

  const handleAddBlock = useCallback(() => {
    setBlockModal({ mode: 'create' });
  }, []);

  const handleCreateBlock = useCallback(({ id, width, height }) => {
    const normalizedId = normalizeId(id);

    if (textBlocks[normalizedId]) {
      setMessage(`ID "${normalizedId}" already exists.`);
      return;
    }

    const result = addNode(nodesById, normalizedId, {
      isBlock: true,
      width,
      height,
    });

    if (setResult(result, `Added block ${id}.`)) {
      setSelectedId(id);
      setSelectedIds(new Set([id]));
      setRootId((current) => current ?? id);
      setBlockModal(null);
    }
  }, [nodesById, setResult, textBlocks]);

  const handleResizeBlock = useCallback(({ id, width, height }) => {
    if (!nodesById[id]?.isBlock) {
      setBlockModal(null);
      return;
    }

    setNodesById((current) => ({
      ...current,
      [id]: {
        ...current[id],
        width,
        height,
      },
    }));
    setBlockModal(null);
    setMessage(`Updated ${id} size.`);
  }, [nodesById]);

  const handleUpdateTextBlock = useCallback((id, patch) => {
    setTextBlocks((current) => {
      const block = current[id];

      if (!block) {
        return current;
      }

      return {
        ...current,
        [id]: {
          ...block,
          ...patch,
        },
      };
    });
  }, []);

  const handleDescriptionChange = useCallback((id, description) => {
    setResult(updateDescription(nodesById, id, description), `Updated ${id}.`);
  }, [nodesById, setResult]);

  const handleToggleChecked = useCallback((id) => {
    setCheckedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const handleMoveSubtree = useCallback((id, subtreeIds, delta) => {
    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    setManualPositions((current) => {
      const next = { ...current };
      const idsToMove = new Set([id, ...subtreeIds]);

      flowNodes.forEach((node) => {
        if (idsToMove.has(node.id)) {
          next[node.id] = {
            x: node.position.x + delta.x,
            y: node.position.y + delta.y,
          };
        }
      });

      return next;
    });
  }, [flowNodes]);

  const handleMoveNodes = useCallback((ids, delta) => {
    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    setManualPositions((current) => {
      const next = { ...current };
      const idsToMove = new Set(ids);

      flowNodes.forEach((node) => {
        if (idsToMove.has(node.id)) {
          next[node.id] = {
            x: node.position.x + delta.x,
            y: node.position.y + delta.y,
          };
        }
      });

      return next;
    });
  }, [flowNodes]);

  const handleSelectNode = useCallback((id, mode = 'replace') => {
    if (!id) {
      setSelectedId(null);
      setSelectedIds(new Set());
      return;
    }

    setSelectedId(id);
    setSelectedIds((current) => {
      if (mode === 'toggle') {
        const next = new Set(current);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        if (next.size === 0) {
          next.add(id);
        }

        return next;
      }

      return new Set([id]);
    });
  }, []);

  const handleSearch = useCallback((query) => {
    const id = normalizeId(query);
    const node = flowNodes.find((item) => item.id === id);

    if (!node) {
      setMessage(`ID "${id}" is not visible or does not exist.`);
      return;
    }

    setSelectedId(id);
    setSelectedIds(new Set([id]));
    flowRef.current?.setCenter(
      node.position.x + 27.5,
      node.position.y + 16,
      { zoom: 1.35, duration: 500 },
    );
    setMessage(`Centered on ${id}.`);
  }, [flowNodes]);

  const handleSelectFromList = useCallback((id) => {
    const node = flowNodes.find((item) => item.id === id);

    setSelectedId(id);
    setSelectedIds(new Set([id]));

    if (node) {
      flowRef.current?.setCenter(
        node.position.x + 27.5,
        node.position.y + 16,
        { zoom: 1.2, duration: 350 },
      );
    }

    setMessage(`Selected ${id}.`);
  }, [flowNodes]);

  const handleSave = useCallback(() => {
    setSaveModalOpen(true);
  }, []);

  const handleSaveWithFilename = useCallback((filename) => {
    const positions = Object.fromEntries(
      flowNodes.map((node) => [node.id, node.position]),
    );
    const textBlocksToSave = Object.fromEntries(
      Object.values(textBlocks).map((block) => [
        block.id,
        {
          ...block,
          position: positions[block.id] ?? block.position,
        },
      ]),
    );

    downloadJson(
      filename,
      serializeProject({
        rootId,
        nodesById,
        checkedIds,
        collapsedIds,
        positions,
        treeDirections,
        connectionSides,
        boundaries,
        textBlocks: textBlocksToSave,
      }),
    );
    setSaveModalOpen(false);
    setMessage(`Project saved as ${filename}.`);
  }, [boundaries, checkedIds, collapsedIds, connectionSides, flowNodes, nodesById, rootId, textBlocks, treeDirections]);

  const handleLoad = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    file.text().then((text) => {
      const result = parseProject(text);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      setNodesById(result.project.nodesById);
      setTextBlocks(result.project.textBlocks ?? {});
      setRootId(result.project.rootId);
      setCheckedIds(new Set(result.project.checkedIds ?? []));
      setSelectedId(result.project.rootId);
      setSelectedIds(new Set(result.project.rootId ? [result.project.rootId] : []));
      setCollapsedIds(new Set(result.project.collapsedIds ?? []));
      setManualPositions(result.project.positions ?? {});
      setTreeDirections(result.project.treeDirections ?? {});
      setConnectionSides(result.project.connectionSides ?? {});
      setBoundaries(result.project.boundaries ?? []);
      setMessage(`Loaded ${file.name}.`);
    });

    event.target.value = '';
  }, []);

  const handleImport = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    file.text().then((text) => {
      const result = parseProject(text);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      const imported = remapProjectForImport(result.project, {
        nodesById,
        textBlocks,
        flowNodes,
        boundaries,
      });

      setNodesById((current) => ({
        ...current,
        ...imported.nodesById,
      }));
      setTextBlocks((current) => ({
        ...current,
        ...imported.textBlocks,
      }));
      setRootId((current) => current ?? imported.rootId);
      setCheckedIds((current) => new Set([...current, ...imported.checkedIds]));
      setCollapsedIds((current) => new Set([...current, ...imported.collapsedIds]));
      setManualPositions((current) => ({
        ...current,
        ...imported.positions,
      }));
      setTreeDirections((current) => ({
        ...current,
        ...imported.treeDirections,
      }));
      setConnectionSides((current) => ({
        ...current,
        ...imported.connectionSides,
      }));
      setBoundaries((current) => [
        ...current,
        ...imported.boundaries,
      ]);
      setSelectedId(imported.rootId);
      setSelectedIds(new Set(imported.rootId ? [imported.rootId] : []));
      setMessage(
        `Imported ${file.name}.${imported.renamedCount > 0 ? ` Renamed ${imported.renamedCount} duplicate ID${imported.renamedCount === 1 ? '' : 's'}.` : ''}`,
      );
    });

    event.target.value = '';
  }, [boundaries, flowNodes, nodesById, textBlocks]);

  const toggleCollapse = useCallback((id) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="app">
      <Toolbar
        nodeCount={Object.keys(nodesById).length}
        edgeCount={edgeCount}
        onSearch={handleSearch}
        onSave={handleSave}
        onLoad={handleLoad}
        onImport={handleImport}
        onAddNode={handleAddNode}
        onAddBlock={handleAddBlock}
        onFit={() => flowRef.current?.fitView({ padding: 0.25, duration: 350 })}
        fileInputRef={fileInputRef}
        importInputRef={importInputRef}
      />

      <div className="workspace">
        <TreeCanvas
          flowNodes={flowNodes}
          nodesById={nodesById}
          rootId={rootId}
          connectionSides={connectionSides}
          boundaries={boundaries}
          collapsedIds={collapsedIds}
          selectedId={selectedId}
          selectedIds={selectedIds}
          contextMenu={contextMenu}
          onContextMenu={setContextMenu}
          onContextAction={handleContextAction}
          onDescriptionChange={handleDescriptionChange}
          onCloseContext={() => setContextMenu(null)}
          onSelect={handleSelectNode}
          checkedIds={checkedIds}
          onToggleChecked={handleToggleChecked}
          onUpdateTextBlock={handleUpdateTextBlock}
          onMoveSubtree={handleMoveSubtree}
          onMoveNodes={handleMoveNodes}
          onConnectIngredient={connectIngredient}
          onDisconnectIngredient={disconnectIngredient}
          onCancelIngredientPick={() => {
            if (pendingIngredientParentId) {
              setPendingIngredientParentId(null);
              setMessage('Ingredient pick cancelled.');
            }
          }}
          pendingIngredientParentId={pendingIngredientParentId}
          onViewportReady={(instance) => {
            flowRef.current = instance;
          }}
        />

        <PropertyPanel
          selectedId={selectedId}
          nodesById={nodesById}
          rootId={rootId}
          onSelectId={handleSelectFromList}
          onSetRoot={(id) => {
            setRootId(id);
            setSelectedId(id);
            setSelectedIds(new Set([id]));
            setMessage(`${id} is now the root view.`);
          }}
          onToggleCollapse={toggleCollapse}
          collapsedIds={collapsedIds}
        />
      </div>

      <footer className="status-bar">{message}</footer>

      <AddTileModal
        open={addTileModalOpen}
        existingIds={new Set(Object.keys(nodesById))}
        onCancel={() => setAddTileModalOpen(false)}
        onCreate={handleCreateNode}
      />

      <AddIngredientsModal
        open={Boolean(ingredientModalParentId)}
        parentId={ingredientModalParentId}
        nodesById={nodesById}
        onCancel={() => setIngredientModalParentId(null)}
        onCreate={handleCreateIngredients}
      />

      <BlockModal
        open={Boolean(blockModal)}
        mode={blockModal?.mode ?? 'create'}
        existingIds={new Set([...Object.keys(nodesById), ...Object.keys(textBlocks)])}
        initialBlock={blockModal?.mode === 'edit' ? nodesById[blockModal.id] : null}
        onCancel={() => setBlockModal(null)}
        onSubmit={blockModal?.mode === 'edit' ? handleResizeBlock : handleCreateBlock}
      />

      <SaveProjectModal
        open={saveModalOpen}
        defaultName="dependency-tree-project.json"
        onCancel={() => setSaveModalOpen(false)}
        onSave={handleSaveWithFilename}
      />
    </div>
  );
}
