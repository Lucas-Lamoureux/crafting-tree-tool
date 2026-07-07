export function wouldCreateCycle(nodesById, parentId, ingredientId) {
  if (parentId === ingredientId) {
    return true;
  }

  const seen = new Set();
  const stack = [ingredientId];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === parentId) {
      return true;
    }

    if (seen.has(currentId)) {
      continue;
    }

    seen.add(currentId);
    const current = nodesById[currentId];

    if (current) {
      stack.push(...current.ingredients);
    }
  }

  return false;
}

export function findCycles(nodesById) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(id, path) {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(start), id]);
      return;
    }

    if (visited.has(id)) {
      return;
    }

    visiting.add(id);
    const node = nodesById[id];

    if (node) {
      node.ingredients.forEach((ingredientId) => visit(ingredientId, [...path, ingredientId]));
    }

    visiting.delete(id);
    visited.add(id);
  }

  Object.keys(nodesById).forEach((id) => visit(id, [id]));
  return cycles;
}
