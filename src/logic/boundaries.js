export function getConnectedTreeIds(nodesById, startId) {
  if (!startId || !nodesById[startId]) {
    return new Set();
  }

  const parentsById = {};

  Object.values(nodesById).forEach((node) => {
    node.ingredients.forEach((ingredientId) => {
      parentsById[ingredientId] ??= [];
      parentsById[ingredientId].push(node.id);
    });
  });

  const connected = new Set();
  const stack = [startId];

  while (stack.length > 0) {
    const id = stack.pop();

    if (connected.has(id) || !nodesById[id]) {
      continue;
    }

    connected.add(id);
    stack.push(...nodesById[id].ingredients);
    stack.push(...(parentsById[id] ?? []));
  }

  return connected;
}

export function getTreeIO(nodesById, ids) {
  const idSet = ids instanceof Set ? ids : new Set(ids);
  const parentCounts = {};

  idSet.forEach((id) => {
    parentCounts[id] = 0;
  });

  idSet.forEach((id) => {
    (nodesById[id]?.ingredients ?? []).forEach((ingredientId) => {
      if (idSet.has(ingredientId)) {
        parentCounts[ingredientId] += 1;
      }
    });
  });

  const sortedIds = [...idSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return {
    inputs: sortedIds.filter((id) => parentCounts[id] === 0),
    outputs: sortedIds.filter((id) => (nodesById[id]?.ingredients ?? []).filter((ingredientId) => idSet.has(ingredientId)).length === 0),
  };
}

export function getBoundaryRole(nodesById, ids, tileId) {
  const { inputs, outputs } = getTreeIO(nodesById, ids);
  const isInput = inputs.includes(tileId);
  const isOutput = outputs.includes(tileId);

  if (isInput && isOutput) {
    return 'I/O';
  }

  if (isInput) {
    return 'I';
  }

  if (isOutput) {
    return 'O';
  }

  return null;
}
