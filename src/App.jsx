import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TreeCanvas from './components/TreeCanvas.jsx';
import Toolbar from './components/Toolbar.jsx';
import PropertyPanel from './components/PropertyPanel.jsx';
import AddTileModal from './components/AddTileModal.jsx';
import SaveProjectModal from './components/SaveProjectModal.jsx';
import { initialTree } from './data/initialTree.js';
import { layoutTree } from './logic/treeLayout.js';
import {
  addIngredient,
  addNode,
  deleteNode,
  deleteNodes,
  normalizeId,
  removeIngredient,
  renameNode,
  updateDescription,
} from './logic/treeUtils.js';
import { downloadJson, parseProject, serializeProject } from './logic/saveLoad.js';

function initialNodesById() {
  return Object.fromEntries(
    Object.values(initialTree.nodes).map((node) => [
      node.id,
      { id: node.id, description: node.description ?? '', ingredients: [...node.ingredients] },
    ]),
  );
}

export default function App() {
  const [nodesById, setNodesById] = useState(initialNodesById);
  const [textBlocks, setTextBlocks] = useState({});
  const [rootId, setRootId] = useState(initialTree.rootId);
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [manualPositions, setManualPositions] = useState({});
  const [layoutDirection, setLayoutDirection] = useState('right');
  const [selectedId, setSelectedId] = useState(initialTree.rootId);
  const [selectedIds, setSelectedIds] = useState(() => new Set([initialTree.rootId]));
  const [pendingIngredientParentId, setPendingIngredientParentId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [addTileModalOpen, setAddTileModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [message, setMessage] = useState('Ready');
  const flowRef = useRef(null);
  const fileInputRef = useRef(null);

  const flowNodes = useMemo(() => {
    const laidOutNodes = layoutTree(nodesById, rootId, collapsedIds, manualPositions, layoutDirection);

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
          layoutDirection,
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
    [checkedIds, collapsedIds, layoutDirection, manualPositions, nodesById, rootId, selectedIds, textBlocks],
  );

  const edgeCount = useMemo(
    () => Object.values(nodesById).reduce((total, node) => total + node.ingredients.length, 0),
    [nodesById],
  );

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

  const connectIngredient = useCallback((parentId, ingredientId) => {
    if (!nodesById[parentId] || !nodesById[ingredientId]) {
      setMessage('Text blocks cannot be connected.');
      return;
    }

    if (nodesById[parentId]?.ingredients.includes(ingredientId)) {
      const result = removeIngredient(nodesById, parentId, ingredientId);
      if (setResult(result, `Removed ${ingredientId} from ${parentId}.`, { preservePositions: true })) {
        setSelectedId(parentId);
        setPendingIngredientParentId(null);
      }
      return;
    }

    const result = addIngredient(nodesById, parentId, ingredientId);

    if (setResult(result, `Added ${ingredientId} to ${parentId}.`)) {
      setSelectedId(ingredientId);
      setPendingIngredientParentId(null);
    }
  }, [nodesById, setResult]);

  const disconnectIngredient = useCallback((parentId, ingredientId) => {
    setResult(
      removeIngredient(nodesById, parentId, ingredientId),
      `Removed ${ingredientId} from ${parentId}.`,
      { preservePositions: true },
    );
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
        setAddTileModalOpen(false);
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

    if (action === 'add') {
      setPendingIngredientParentId(id);
      setMessage(`Click an existing ID to add it as an ingredient of ${id}.`);
    }

    if (action === 'remove') {
      const ingredientId = normalizeId(window.prompt(`Remove which ingredient from ${id}?`));
      if (!ingredientId) return;
      setResult(
        removeIngredient(nodesById, id, ingredientId),
        `Removed ${ingredientId} from ${id}.`,
        { preservePositions: true },
      );
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
  }, [contextMenu, nodesById, removeNodeById, removeNodesByIds, rootId, selectedIds, setResult]);

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

  const handleAddTextBlock = useCallback(() => {
    const existingIds = new Set([...Object.keys(nodesById), ...Object.keys(textBlocks)]);
    let index = Object.keys(textBlocks).length + 1;
    let id = `text-${index}`;

    while (existingIds.has(id)) {
      index += 1;
      id = `text-${index}`;
    }

    const position = flowRef.current?.screenToFlowPosition?.({ x: 180, y: 160 }) ?? { x: 40, y: 40 };

    setTextBlocks((current) => ({
      ...current,
      [id]: {
        id,
        title: `Text ${index}`,
        text: '',
        fontSize: 14,
        width: 220,
        height: 140,
        position,
      },
    }));
    setSelectedId(id);
    setSelectedIds(new Set([id]));
    setMessage(`Added ${id}.`);
  }, [nodesById, textBlocks]);

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
        layoutDirection,
        textBlocks: textBlocksToSave,
      }),
    );
    setSaveModalOpen(false);
    setMessage(`Project saved as ${filename}.`);
  }, [checkedIds, collapsedIds, flowNodes, layoutDirection, nodesById, rootId, textBlocks]);

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
      setLayoutDirection(result.project.layoutDirection ?? 'right');
      setMessage(`Loaded ${file.name}.`);
    });

    event.target.value = '';
  }, []);

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

  const handleRelayout = useCallback(() => {
    setManualPositions({});
    window.requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.25, duration: 350 }));
    setMessage('Tree layout rebuilt.');
  }, []);

  const handleLayoutDirectionChange = useCallback((direction) => {
    setLayoutDirection(direction);
    setManualPositions({});
    window.requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.25, duration: 350 }));
    setMessage(`Branches now grow ${direction}.`);
  }, []);

  return (
    <div className="app">
      <Toolbar
        nodeCount={Object.keys(nodesById).length}
        edgeCount={edgeCount}
        onSearch={handleSearch}
        onSave={handleSave}
        onLoad={handleLoad}
        onAddNode={handleAddNode}
        onAddTextBlock={handleAddTextBlock}
        onRelayout={handleRelayout}
        onFit={() => flowRef.current?.fitView({ padding: 0.25, duration: 350 })}
        layoutDirection={layoutDirection}
        onLayoutDirectionChange={handleLayoutDirectionChange}
        fileInputRef={fileInputRef}
      />

      <div className="workspace">
        <TreeCanvas
          flowNodes={flowNodes}
          nodesById={nodesById}
          rootId={rootId}
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

      <SaveProjectModal
        open={saveModalOpen}
        defaultName="dependency-tree-project.json"
        onCancel={() => setSaveModalOpen(false)}
        onSave={handleSaveWithFilename}
      />
    </div>
  );
}
