import { getParents, toNodeArray } from '../logic/treeUtils.js';

export default function PropertyPanel({
  selectedId,
  nodesById,
  rootId,
  onSelectId,
  onSetRoot,
  onToggleCollapse,
  collapsedIds,
}) {
  const selected = selectedId ? nodesById[selectedId] : null;
  const parents = selected ? getParents(nodesById, selected.id) : [];
  const allNodes = toNodeArray(nodesById);

  return (
    <aside className="property-panel">
      <section>
        <h2>Selection</h2>
        {selected ? (
          <div className="node-details">
            <div className="detail-id">{selected.id}</div>
            <dl>
              <div>
                <dt>Ingredients</dt>
                <dd>{selected.ingredients.length || '0'}</dd>
              </div>
              <div>
                <dt>Parents</dt>
                <dd>{parents.length || '0'}</dd>
              </div>
            </dl>
            {selected.description && <p className="node-description">{selected.description}</p>}
            <button onClick={() => onSetRoot(selected.id)} disabled={rootId === selected.id}>
              Set as root
            </button>
            <button onClick={() => onToggleCollapse(selected.id)} disabled={selected.ingredients.length === 0}>
              {collapsedIds.has(selected.id) ? 'Expand branch' : 'Collapse branch'}
            </button>
          </div>
        ) : (
          <p className="muted">Select or right-click a node.</p>
        )}
      </section>

      <section>
        <h2>All IDs</h2>
        <div className="id-list">
          {allNodes.map((node) => (
            <button
              key={node.id}
              className={node.id === selectedId ? 'active' : ''}
              onClick={() => onSelectId(node.id)}
              title={node.description || node.id}
            >
              {node.id}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
