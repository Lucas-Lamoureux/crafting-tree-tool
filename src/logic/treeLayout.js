import { getDescendants, getVisibleIds } from './treeUtils.js';

const NODE_WIDTH = 55;
const NODE_HEIGHT = 32;
const HORIZONTAL_GAP = 82;
const VERTICAL_GAP = 54;

export const nodeSize = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
};

export const layoutDirections = ['right', 'left', 'down', 'up'];

function getBasePosition(depth, branchIndex, direction) {
  const depthOffset = depth * (NODE_WIDTH + HORIZONTAL_GAP);
  const branchOffset = branchIndex - NODE_HEIGHT / 2;

  if (direction === 'left') {
    return {
      x: -depthOffset,
      y: branchOffset,
    };
  }

  if (direction === 'down') {
    return {
      x: branchIndex - NODE_WIDTH / 2,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    };
  }

  if (direction === 'up') {
    return {
      x: branchIndex - NODE_WIDTH / 2,
      y: -depth * (NODE_HEIGHT + VERTICAL_GAP),
    };
  }

  return {
    x: depthOffset,
    y: branchOffset,
  };
}

export function layoutTree(
  nodesById,
  rootId,
  collapsedIds = new Set(),
  pinnedPositions = {},
  direction = 'right',
) {
  const layoutDirection = layoutDirections.includes(direction) ? direction : 'right';
  const visibleIds = getVisibleIds(nodesById, rootId, collapsedIds);
  const positioned = new Map();
  const visiting = new Set();
  let leafCursor = 0;

  function place(id, depth) {
    if (positioned.has(id)) {
      return positioned.get(id).y + NODE_HEIGHT / 2;
    }

    if (visiting.has(id) || !nodesById[id]) {
      return leafCursor * (NODE_HEIGHT + VERTICAL_GAP);
    }

    visiting.add(id);

    const children = collapsedIds.has(id)
      ? []
      : nodesById[id].ingredients.filter((ingredientId) => visibleIds.includes(ingredientId));

    let centerY;

    if (children.length === 0) {
      centerY = leafCursor * (NODE_HEIGHT + VERTICAL_GAP);
      leafCursor += 1;
    } else {
      const childCenters = children.map((childId) => place(childId, depth + 1));
      centerY = (Math.min(...childCenters) + Math.max(...childCenters)) / 2;
    }

    const basePosition = getBasePosition(depth, centerY, layoutDirection);

    const position = pinnedPositions[id] ?? basePosition;
    positioned.set(id, position);
    visiting.delete(id);
    return centerY;
  }

  if (rootId && nodesById[rootId]) {
    place(rootId, 0);
  }

  visibleIds.forEach((id) => {
    if (!positioned.has(id)) {
      const pinned = pinnedPositions[id];
      positioned.set(id, pinned ?? getBasePosition(0, leafCursor * (NODE_HEIGHT + VERTICAL_GAP), layoutDirection));
      leafCursor += 1;
    }
  });

  return visibleIds.map((id) => ({
    id,
    type: 'treeNode',
    position: positioned.get(id),
    data: {
      id,
      description: nodesById[id]?.description ?? '',
      ingredientCount: nodesById[id]?.ingredients.length ?? 0,
      collapsed: collapsedIds.has(id),
    },
    draggable: true,
  }));
}

export function layoutSubtreePositions(nodesById, rootId, collapsedIds = new Set(), direction = 'right', anchor = null) {
  if (!rootId || !nodesById[rootId]) {
    return {};
  }

  const idsToLayout = new Set([rootId, ...getDescendants(nodesById, rootId)]);
  const subtreeNodes = {};

  idsToLayout.forEach((id) => {
    const node = nodesById[id];

    if (node) {
      subtreeNodes[id] = {
        ...node,
        ingredients: node.ingredients.filter((ingredientId) => idsToLayout.has(ingredientId)),
      };
    }
  });

  const laidOutNodes = layoutTree(subtreeNodes, rootId, collapsedIds, {}, direction);
  const rootPosition = laidOutNodes.find((node) => node.id === rootId)?.position ?? { x: 0, y: 0 };
  const offset = anchor
    ? {
      x: anchor.x - rootPosition.x,
      y: anchor.y - rootPosition.y,
    }
    : { x: 0, y: 0 };

  return Object.fromEntries(
    laidOutNodes.map((node) => [
      node.id,
      {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    ]),
  );
}
