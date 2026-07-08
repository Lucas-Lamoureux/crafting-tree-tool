import { getDescendants, getVisibleIds } from './treeUtils.js';

const NODE_WIDTH = 55;
const NODE_HEIGHT = 32;
const HORIZONTAL_GAP = 56;
const VERTICAL_GAP = 36;
const SIBLING_GAP = 2;
const GROUP_GAP = 4;
const TILE_LABEL_PADDING = 26;
const AVERAGE_CHARACTER_WIDTH = 7.4;

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

  const positions = layoutGroupedSubtree(subtreeNodes, rootId, direction);
  const rootPosition = positions[rootId] ?? { x: 0, y: 0 };
  const offset = anchor
    ? {
      x: anchor.x - rootPosition.x,
      y: anchor.y - rootPosition.y,
    }
    : { x: 0, y: 0 };

  return Object.fromEntries(
    Object.entries(positions).map(([id, position]) => [
      id,
      {
        x: position.x + offset.x,
        y: position.y + offset.y,
      },
    ]),
  );
}

function layoutGroupedSubtree(nodesById, rootId, direction = 'right') {
  const layoutDirection = layoutDirections.includes(direction) ? direction : 'right';
  const tiers = [];
  const parentById = {};
  const seen = new Set();
  const queue = [{ id: rootId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();

    if (seen.has(id) || !nodesById[id]) {
      continue;
    }

    seen.add(id);
    tiers[depth] ??= [];
    tiers[depth].push(id);

    nodesById[id].ingredients.forEach((childId) => {
      if (!nodesById[childId] || seen.has(childId)) {
        return;
      }

      parentById[childId] ??= id;
      queue.push({ id: childId, depth: depth + 1 });
    });
  }

  const widestDepth = tiers.reduce((widest, tier, depth) => (
    (tier?.length ?? 0) > (tiers[widest]?.length ?? 0) ? depth : widest
  ), 0);
  const crossPositions = {};

  assignTierByGroups(nodesById, tiers, parentById, widestDepth, crossPositions, layoutDirection);

  for (let depth = widestDepth - 1; depth >= 0; depth -= 1) {
    (tiers[depth] ?? []).forEach((id) => {
      const childPositions = getChildrenInTier(nodesById, id, tiers[depth + 1] ?? [], parentById)
        .map((childId) => crossPositions[childId])
        .filter((position) => Number.isFinite(position));

      if (childPositions.length > 0) {
        crossPositions[id] = (Math.min(...childPositions) + Math.max(...childPositions)) / 2;
      }
    });
  }

  for (let depth = widestDepth + 1; depth < tiers.length; depth += 1) {
    assignTierBelowParents(nodesById, tiers, parentById, depth, crossPositions, layoutDirection);
  }

  tiers.forEach((tier, depth) => {
    assignMissingTierPositions(nodesById, tier ?? [], crossPositions, layoutDirection);
  });

  const positioned = {};

  tiers.forEach((tier, depth) => {
    (tier ?? []).forEach((id) => {
      positioned[id] = toPosition(nodesById, id, depth, crossPositions[id] ?? 0, layoutDirection);
    });
  });

  return positioned;
}

function isVerticalLayout(direction) {
  return direction === 'up' || direction === 'down';
}

function getNodeWidth(nodesById, id) {
  const node = nodesById[id];

  if (Number.isFinite(node?.width)) {
    return node.width;
  }

  return Math.max(
    NODE_WIDTH,
    Math.ceil(String(id).length * AVERAGE_CHARACTER_WIDTH + TILE_LABEL_PADDING),
  );
}

function getNodeHeight(nodesById, id) {
  const node = nodesById[id];

  if (Number.isFinite(node?.height)) {
    return node.height;
  }

  return NODE_HEIGHT;
}

function getCrossSize(nodesById, id, direction) {
  return isVerticalLayout(direction)
    ? getNodeWidth(nodesById, id)
    : getNodeHeight(nodesById, id);
}

function getChildrenInTier(nodesById, parentId, tier = [], parentById = {}) {
  const tierSet = new Set(tier);

  return nodesById[parentId].ingredients.filter((childId) => (
    tierSet.has(childId) && parentById[childId] === parentId
  ));
}

function assignTierByGroups(nodesById, tiers, parentById, depth, crossPositions, direction) {
  const tier = tiers[depth] ?? [];

  if (tier.length === 0) {
    return;
  }

  if (depth === 0) {
    crossPositions[tier[0]] = 0;
    return;
  }

  const groups = [];
  const previousTier = tiers[depth - 1] ?? [];

  previousTier.forEach((parentId) => {
    const children = tier.filter((id) => parentById[id] === parentId);

    if (children.length > 0) {
      groups.push(children);
    }
  });

  const groupedIds = new Set(groups.flat());
  const ungrouped = tier.filter((id) => !groupedIds.has(id));

  if (ungrouped.length > 0) {
    groups.push(ungrouped);
  }

  let cursor = 0;

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      cursor += GROUP_GAP;
    }

    group.forEach((id, index) => {
      const crossSize = getCrossSize(nodesById, id, direction);

      if (index > 0) {
        cursor += SIBLING_GAP;
      }

      crossPositions[id] = cursor + crossSize / 2;
      cursor += crossSize;
    });
  });

  centerAssignedTier(nodesById, tier, crossPositions, direction);
}

function assignTierBelowParents(nodesById, tiers, parentById, depth, crossPositions, direction) {
  const tier = tiers[depth] ?? [];
  const previousTier = tiers[depth - 1] ?? [];
  let previousEnd = -Infinity;

  previousTier.forEach((parentId) => {
    const children = getChildrenInTier(nodesById, parentId, tier, parentById);

    if (children.length === 0) {
      return;
    }

    const groupWidth = children.reduce(
      (total, childId, index) => total + getCrossSize(nodesById, childId, direction) + (index > 0 ? SIBLING_GAP : 0),
      0,
    );
    const parentCenter = crossPositions[parentId] ?? 0;
    let start = parentCenter - groupWidth / 2;

    if (Number.isFinite(previousEnd)) {
      start = Math.max(start, previousEnd + GROUP_GAP);
    }

    let cursor = start;

    children.forEach((childId, index) => {
      const crossSize = getCrossSize(nodesById, childId, direction);

      if (index > 0) {
        cursor += SIBLING_GAP;
      }

      crossPositions[childId] = cursor + crossSize / 2;
      cursor += crossSize;
    });

    previousEnd = start + groupWidth;
  });
}

function assignMissingTierPositions(nodesById, tier, crossPositions, direction) {
  let cursor = Math.max(
    0,
    ...tier
      .filter((id) => Number.isFinite(crossPositions[id]))
      .map((id) => crossPositions[id] + getCrossSize(nodesById, id, direction) / 2 + GROUP_GAP),
  );

  tier.forEach((id) => {
    if (Number.isFinite(crossPositions[id])) {
      return;
    }

    const crossSize = getCrossSize(nodesById, id, direction);
    crossPositions[id] = cursor + crossSize / 2;
    cursor += crossSize + SIBLING_GAP;
  });
}

function centerAssignedTier(nodesById, tier, crossPositions, direction) {
  const bounds = tier
    .filter((id) => Number.isFinite(crossPositions[id]))
    .map((id) => {
      const halfSize = getCrossSize(nodesById, id, direction) / 2;

      return {
        start: crossPositions[id] - halfSize,
        end: crossPositions[id] + halfSize,
      };
    });

  if (bounds.length === 0) {
    return;
  }

  const offset = (Math.min(...bounds.map((bound) => bound.start)) + Math.max(...bounds.map((bound) => bound.end))) / 2;

  tier.forEach((id) => {
    if (Number.isFinite(crossPositions[id])) {
      crossPositions[id] -= offset;
    }
  });
}

function toPosition(nodesById, id, depth, crossCenter, direction) {
  if (direction === 'left') {
    return {
      x: -depth * (NODE_WIDTH + HORIZONTAL_GAP),
      y: crossCenter - getNodeHeight(nodesById, id) / 2,
    };
  }

  if (direction === 'down') {
    return {
      x: crossCenter - getNodeWidth(nodesById, id) / 2,
      y: depth * (NODE_HEIGHT + VERTICAL_GAP),
    };
  }

  if (direction === 'up') {
    return {
      x: crossCenter - getNodeWidth(nodesById, id) / 2,
      y: -depth * (NODE_HEIGHT + VERTICAL_GAP),
    };
  }

  return {
    x: depth * (NODE_WIDTH + HORIZONTAL_GAP),
    y: crossCenter - getNodeHeight(nodesById, id) / 2,
  };
}
