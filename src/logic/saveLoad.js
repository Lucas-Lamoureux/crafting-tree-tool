import { findCycles } from './cycleDetection.js';
import { normalizeId } from './treeUtils.js';

export function serializeProject(project) {
  const positions = Object.fromEntries(
    Object.entries(project.positions ?? {})
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([id, position]) => [
        id,
        {
          x: Number(position.x),
          y: Number(position.y),
        },
      ]),
  );

  const nodes = Object.values(project.nodesById)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((node) => ({
      id: node.id,
      description: node.description ?? '',
      ingredients: [...node.ingredients],
      isBlock: Boolean(node.isBlock),
      isFrame: Boolean(node.isFrame),
      frameTitle: node.frameTitle,
      frameContentIds: node.frameContentIds ?? (node.frameContentId ? [node.frameContentId] : []),
      dataRows: [...(node.dataRows ?? [])],
      width: node.width,
      height: node.height,
    }));

  return JSON.stringify(
    {
      name: 'Dependency Tree Explorer',
      rootId: project.rootId,
      treeDirections: Object.fromEntries(
        Object.entries(project.treeDirections ?? {})
          .filter(([id, direction]) => project.nodesById[id] && ['right', 'left', 'down', 'up'].includes(direction))
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
      ),
      connectionSides: serializeConnectionSides(project.connectionSides, project.nodesById),
      checkedIds: [...(project.checkedIds ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      collapsedIds: [...(project.collapsedIds ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      boundaries: serializeBoundaries(project.boundaries, project.nodesById),
      boundaryLinks: serializeBoundaryLinks(project.boundaryLinks, project.boundaries),
      positions,
      textBlocks: Object.values(project.textBlocks ?? {})
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map((block) => ({
          id: block.id,
          title: block.title,
          text: block.text,
          fontSize: block.fontSize,
          width: block.width,
          height: block.height,
          position: block.position,
        })),
      nodes,
    },
    null,
    2,
  );
}

export function parseProject(jsonText) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }

  const rawNodes = Array.isArray(parsed.nodes)
    ? parsed.nodes
    : Object.values(parsed.nodesById ?? parsed.nodes ?? {});

  if (!Array.isArray(rawNodes)) {
    return { ok: false, message: 'Project JSON must include a nodes array.' };
  }

  const nodesById = {};

  for (const rawNode of rawNodes) {
    const id = normalizeId(rawNode?.id);

    if (!id) {
      return { ok: false, message: 'Every node must have a non-empty ID.' };
    }

    if (nodesById[id]) {
      return { ok: false, message: `Duplicate ID "${id}" found in the file.` };
    }

    if (!Array.isArray(rawNode.ingredients)) {
      return { ok: false, message: `Node "${id}" must have an ingredients array.` };
    }

    const ingredients = rawNode.ingredients.map(normalizeId);

    if (ingredients.some((ingredientId) => !ingredientId)) {
      return { ok: false, message: `Node "${id}" has an empty ingredient reference.` };
    }

    if (new Set(ingredients).size !== ingredients.length) {
      return { ok: false, message: `Node "${id}" lists the same ingredient more than once.` };
    }

    nodesById[id] = {
      id,
      description: String(rawNode.description ?? ''),
      ingredients,
      isBlock: Boolean(rawNode.isBlock),
      isFrame: Boolean(rawNode.isFrame),
      frameTitle: rawNode.isFrame ? String(rawNode.frameTitle ?? id) : undefined,
      frameContentIds: rawNode.isFrame
        ? (Array.isArray(rawNode.frameContentIds)
          ? rawNode.frameContentIds.map(normalizeId).filter(Boolean)
          : [normalizeId(rawNode.frameContentId)].filter(Boolean))
        : [],
      dataRows: Array.isArray(rawNode.dataRows) ? rawNode.dataRows.map((value) => String(value ?? '')) : [],
      width: rawNode.isBlock || rawNode.isFrame ? clampNodeSize(rawNode.width, 55) : undefined,
      height: rawNode.isBlock || rawNode.isFrame ? clampNodeSize(rawNode.height, 32) : undefined,
    };
  }

  for (const node of Object.values(nodesById)) {
    for (const ingredientId of node.ingredients) {
      if (!nodesById[ingredientId]) {
        nodesById[ingredientId] = { id: ingredientId, description: '', ingredients: [] };
      }
    }
  }

  const cycles = findCycles(nodesById);

  if (cycles.length > 0) {
    return { ok: false, message: `Cycle detected: ${cycles[0].join(' -> ')}` };
  }

  const rootId = normalizeId(parsed.rootId) || Object.keys(nodesById)[0] || null;
  const checkedIds = Array.isArray(parsed.checkedIds)
    ? parsed.checkedIds.map(normalizeId).filter((id) => nodesById[id])
    : [];
  const collapsedIds = Array.isArray(parsed.collapsedIds)
    ? parsed.collapsedIds.map(normalizeId).filter((id) => nodesById[id])
    : [];
  const positions = {};
  const textBlocks = {};
  const treeDirections = {};
  const connectionSides = {};
  const boundaries = [];
  const boundaryLinks = [];

  if (parsed.treeDirections && typeof parsed.treeDirections === 'object' && !Array.isArray(parsed.treeDirections)) {
    Object.entries(parsed.treeDirections).forEach(([rawId, direction]) => {
      const id = normalizeId(rawId);

      if (nodesById[id] && ['right', 'left', 'down', 'up'].includes(direction)) {
        treeDirections[id] = direction;
      }
    });
  } else if (['right', 'left', 'down', 'up'].includes(parsed.layoutDirection) && nodesById[rootId]) {
    treeDirections[rootId] = parsed.layoutDirection;
  }

  if (parsed.positions && typeof parsed.positions === 'object' && !Array.isArray(parsed.positions)) {
    Object.entries(parsed.positions).forEach(([rawId, rawPosition]) => {
      const id = normalizeId(rawId);
      const x = Number(rawPosition?.x);
      const y = Number(rawPosition?.y);

      if (nodesById[id] && Number.isFinite(x) && Number.isFinite(y)) {
        positions[id] = { x, y };
      }
    });
  }

  if (parsed.connectionSides && typeof parsed.connectionSides === 'object' && !Array.isArray(parsed.connectionSides)) {
    Object.entries(parsed.connectionSides).forEach(([rawParentId, rawChildren]) => {
      const parentId = normalizeId(rawParentId);

      if (!nodesById[parentId] || typeof rawChildren !== 'object' || Array.isArray(rawChildren)) {
        return;
      }

      Object.entries(rawChildren).forEach(([rawChildId, side]) => {
        const childId = normalizeId(rawChildId);

        if (
          nodesById[childId]
          && nodesById[parentId].ingredients.includes(childId)
          && ['right', 'left', 'down', 'up'].includes(side)
        ) {
          connectionSides[parentId] ??= {};
          connectionSides[parentId][childId] = side;
        }
      });
    });
  }

  if (Array.isArray(parsed.textBlocks)) {
    parsed.textBlocks.forEach((rawBlock) => {
      const id = normalizeId(rawBlock?.id);
      const x = Number(rawBlock?.position?.x);
      const y = Number(rawBlock?.position?.y);
      const width = Number(rawBlock?.width);
      const height = Number(rawBlock?.height);
      const fontSize = Number(rawBlock?.fontSize);

      if (id && !nodesById[id]) {
        textBlocks[id] = {
          id,
          title: String(rawBlock.title ?? 'Text Block'),
          text: String(rawBlock.text ?? ''),
          fontSize: Number.isFinite(fontSize) ? Math.min(48, Math.max(10, fontSize)) : 14,
          width: Number.isFinite(width) ? Math.max(120, width) : 220,
          height: Number.isFinite(height) ? Math.max(90, height) : 140,
          position: {
            x: Number.isFinite(x) ? x : 40,
            y: Number.isFinite(y) ? y : 40,
          },
        };
      }
    });
  }

  if (Array.isArray(parsed.boundaries)) {
    parsed.boundaries.forEach((rawBoundary, index) => {
      const rootId = normalizeId(rawBoundary?.rootId);
      const x = Number(rawBoundary?.position?.x);
      const y = Number(rawBoundary?.position?.y);
      const width = Number(rawBoundary?.width);
      const height = Number(rawBoundary?.height);

      if (!rootId || nodesById[rootId]) {
        boundaries.push({
          id: normalizeId(rawBoundary?.id) || `boundary-${index + 1}`,
          rootId: rootId || null,
          title: String(rawBoundary?.title ?? 'Boundary'),
          position: {
            x: Number.isFinite(x) ? x : 120,
            y: Number.isFinite(y) ? y : 120,
          },
          width: Number.isFinite(width) ? Math.max(260, width) : 440,
          height: Number.isFinite(height) ? Math.max(180, height) : 230,
        });
      }
    });
  }

  if (Array.isArray(parsed.boundaryLinks)) {
    const boundaryIds = new Set(boundaries.map((boundary) => boundary.id));

    parsed.boundaryLinks.forEach((rawLink, index) => {
      const source = normalizeId(rawLink?.source);
      const target = normalizeId(rawLink?.target);

      if (source && target && source !== target && boundaryIds.has(source) && boundaryIds.has(target)) {
        boundaryLinks.push({
          id: normalizeId(rawLink?.id) || `${source}->${target}-${index + 1}`,
          source,
          target,
          sourceHandle: String(rawLink?.sourceHandle ?? ''),
          targetHandle: String(rawLink?.targetHandle ?? ''),
        });
      }
    });
  }

  return {
    ok: true,
    project: {
      rootId: nodesById[rootId] ? rootId : Object.keys(nodesById)[0] ?? null,
      nodesById,
      checkedIds,
      collapsedIds,
      positions,
      textBlocks,
      treeDirections,
      connectionSides,
      boundaries,
      boundaryLinks,
    },
  };
}

function serializeBoundaryLinks(boundaryLinks = [], boundaries = []) {
  const boundaryIds = new Set((boundaries ?? []).map((boundary) => boundary.id));

  return (boundaryLinks ?? [])
    .filter((link) => boundaryIds.has(link.source) && boundaryIds.has(link.target))
    .map((link, index) => ({
      id: link.id ?? `${link.source}->${link.target}-${index + 1}`,
      source: link.source,
      target: link.target,
      sourceHandle: link.sourceHandle ?? '',
      targetHandle: link.targetHandle ?? '',
    }));
}

function serializeBoundaries(boundaries = [], nodesById = {}) {
  return boundaries
    .filter((boundary) => !boundary.rootId || nodesById[boundary.rootId])
    .map((boundary, index) => ({
      id: boundary.id ?? `boundary-${index + 1}`,
      rootId: boundary.rootId ?? null,
      title: boundary.title ?? 'Boundary',
      position: boundary.position,
      width: boundary.width,
      height: boundary.height,
    }));
}

function serializeConnectionSides(connectionSides = {}, nodesById = {}) {
  return Object.fromEntries(
    Object.entries(connectionSides)
      .filter(([parentId]) => nodesById[parentId])
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([parentId, children]) => [
        parentId,
        Object.fromEntries(
          Object.entries(children ?? {})
            .filter(([childId, side]) => (
              nodesById[childId]
              && nodesById[parentId].ingredients.includes(childId)
              && ['right', 'left', 'down', 'up'].includes(side)
            ))
            .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
        ),
      ])
      .filter(([, children]) => Object.keys(children).length > 0),
  );
}

function clampNodeSize(value, fallback) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return fallback;
  }

  return Math.min(600, Math.max(24, Math.round(size)));
}

export function downloadJson(filename, jsonText) {
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
