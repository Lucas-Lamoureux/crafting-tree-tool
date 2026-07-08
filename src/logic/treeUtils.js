import { wouldCreateCycle } from './cycleDetection.js';

export function normalizeId(value) {
  return String(value ?? '').trim();
}

export function createNode(id, options = {}) {
  return {
    id,
    ingredients: [],
    description: '',
    isBlock: Boolean(options.isBlock),
    width: options.width,
    height: options.height,
  };
}

export function addNode(nodesById, id, options = {}) {
  if (!id) {
    return { ok: false, message: 'Enter an ID first.' };
  }

  if (nodesById[id]) {
    return { ok: false, message: `ID "${id}" already exists.` };
  }

  return {
    ok: true,
    nodesById: {
      ...nodesById,
      [id]: createNode(id, options),
    },
  };
}

export function deriveEdges(nodesById, collapsedIds = new Set(), rootId = null) {
  const visible = getVisibleIds(nodesById, rootId, collapsedIds);
  const visibleSet = new Set(visible);
  const edges = [];

  visible.forEach((parentId) => {
    if (collapsedIds.has(parentId)) {
      return;
    }

    const parent = nodesById[parentId];
    parent.ingredients.forEach((ingredientId) => {
      if (visibleSet.has(ingredientId)) {
        edges.push({
          id: `${parentId}->${ingredientId}`,
          source: parentId,
          target: ingredientId,
          type: 'straight',
          animated: false,
          style: { strokeWidth: 1.8 },
        });
      }
    });
  });

  return edges;
}

export function getVisibleIds(nodesById, rootId, collapsedIds) {
  if (!rootId || !nodesById[rootId]) {
    return Object.keys(nodesById);
  }

  const visible = [];
  const seen = new Set();
  const stack = [rootId];

  while (stack.length > 0) {
    const id = stack.pop();

    if (seen.has(id) || !nodesById[id]) {
      continue;
    }

    seen.add(id);
    visible.push(id);

    if (!collapsedIds.has(id)) {
      [...nodesById[id].ingredients].reverse().forEach((ingredientId) => stack.push(ingredientId));
    }
  }

  Object.keys(nodesById).forEach((id) => {
    if (!seen.has(id)) {
      visible.push(id);
    }
  });

  return visible;
}

export function addIngredient(nodesById, parentId, ingredientId) {
  const parent = nodesById[parentId];

  if (!parent) {
    return { ok: false, message: `Parent "${parentId}" does not exist.` };
  }

  if (parent.ingredients.includes(ingredientId)) {
    return { ok: false, message: `"${ingredientId}" is already an ingredient of "${parentId}".` };
  }

  if (wouldCreateCycle(nodesById, parentId, ingredientId)) {
    return { ok: false, message: `Adding "${ingredientId}" would create a cycle.` };
  }

  const next = {
    ...nodesById,
    [parentId]: {
      ...parent,
      ingredients: [...parent.ingredients, ingredientId],
    },
  };

  if (!next[ingredientId]) {
      next[ingredientId] = createNode(ingredientId);
  }

  return { ok: true, nodesById: next };
}

export function removeIngredient(nodesById, parentId, ingredientId) {
  const parent = nodesById[parentId];

  if (!parent || !parent.ingredients.includes(ingredientId)) {
    return { ok: false, message: `"${ingredientId}" is not an ingredient of "${parentId}".` };
  }

  return {
    ok: true,
    nodesById: {
      ...nodesById,
      [parentId]: {
        ...parent,
        ingredients: parent.ingredients.filter((id) => id !== ingredientId),
      },
    },
  };
}

export function updateDescription(nodesById, id, description) {
  if (!nodesById[id]) {
    return { ok: false, message: `Node "${id}" does not exist.` };
  }

  return {
    ok: true,
    nodesById: {
      ...nodesById,
      [id]: {
        ...nodesById[id],
        description,
      },
    },
  };
}

export function renameNode(nodesById, oldId, newId, rootId) {
  if (!nodesById[oldId]) {
    return { ok: false, message: `Node "${oldId}" does not exist.` };
  }

  if (nodesById[newId]) {
    return { ok: false, message: `ID "${newId}" already exists.` };
  }

  const next = {};

  Object.values(nodesById).forEach((node) => {
    const id = node.id === oldId ? newId : node.id;
    next[id] = {
      id,
      description: node.description ?? '',
      ingredients: node.ingredients.map((ingredientId) => (ingredientId === oldId ? newId : ingredientId)),
      isBlock: Boolean(node.isBlock),
      width: node.width,
      height: node.height,
    };
  });

  return {
    ok: true,
    nodesById: next,
    rootId: rootId === oldId ? newId : rootId,
  };
}

export function deleteNode(nodesById, id, rootId) {
  if (!nodesById[id]) {
    return { ok: false, message: `Node "${id}" does not exist.` };
  }

  const next = {};

  Object.entries(nodesById).forEach(([nodeId, node]) => {
    if (nodeId !== id) {
      next[nodeId] = {
        ...node,
        ingredients: node.ingredients.filter((ingredientId) => ingredientId !== id),
      };
    }
  });

  const remainingIds = Object.keys(next);

  return {
    ok: true,
    nodesById: next,
    rootId: rootId === id ? remainingIds[0] ?? null : rootId,
  };
}

export function deleteNodes(nodesById, ids, rootId) {
  const idsToDelete = new Set(ids);

  if (idsToDelete.size === 0) {
    return { ok: false, message: 'No tiles are selected.' };
  }

  const missingId = [...idsToDelete].find((id) => !nodesById[id]);

  if (missingId) {
    return { ok: false, message: `Node "${missingId}" does not exist.` };
  }

  const next = {};

  Object.entries(nodesById).forEach(([nodeId, node]) => {
    if (!idsToDelete.has(nodeId)) {
      next[nodeId] = {
        ...node,
        ingredients: node.ingredients.filter((ingredientId) => !idsToDelete.has(ingredientId)),
      };
    }
  });

  const remainingIds = Object.keys(next);

  return {
    ok: true,
    nodesById: next,
    rootId: idsToDelete.has(rootId) ? remainingIds[0] ?? null : rootId,
    deletedIds: [...idsToDelete],
  };
}

export function getParents(nodesById, childId) {
  return Object.values(nodesById)
    .filter((node) => node.ingredients.includes(childId))
    .map((node) => node.id);
}

export function getDescendants(nodesById, id, collapsedIds = new Set()) {
  const descendants = new Set();
  const stack = collapsedIds.has(id) ? [] : [...(nodesById[id]?.ingredients ?? [])];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (descendants.has(currentId) || !nodesById[currentId]) {
      continue;
    }

    descendants.add(currentId);

    if (!collapsedIds.has(currentId)) {
      stack.push(...nodesById[currentId].ingredients);
    }
  }

  return descendants;
}

export function toNodeArray(nodesById) {
  return Object.values(nodesById).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
