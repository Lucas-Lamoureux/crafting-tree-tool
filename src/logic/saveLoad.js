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
      checkedIds: [...(project.checkedIds ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      collapsedIds: [...(project.collapsedIds ?? [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
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
    },
  };
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
