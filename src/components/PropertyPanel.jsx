import { useState } from 'react';
import { getParents, toNodeArray } from '../logic/treeUtils.js';

const DATA_ROW_TITLES = [
  'Water (lbs/min)', 'Ethanol (lbs/min)', 'CO2 (lbs/min)', 'Starch (lbs/min)', 'DP2+ (lbs/min)',
  'Dextrose (lbs/min)', 'Protein (lbs/min)', 'Soluble Protein (lbs/min)', 'Fiber (lbs/min)', 'Free Oil (lbs/min)',
  'Bound Oil (lbs/min)', 'Fatty Acids (lbs/min)', 'Glycerol (lbs/min)', 'Organic Acids (lbs/min)', 'Sulfates (lbs/min)',
  'Ash - Other (lbs/min)', 'Air (lbs/min)', 'Temp (F)', 'Pressure (psia)', 'Volumetric Flow (CFM)',
  'Volumetric Flow (gpm)', 'Mass Flow (lbs/min)', 'Density (lbs/gal)', 'Specific Gravity (sp gr)', 'Specific Heat',
  'Hvap', 'DS', 'Pipe Size (in)', 'Velocity (ft/sec)',
];

export default function PropertyPanel({
  selectedId,
  nodesById,
  rootId,
  onSelectId,
  onSetRoot,
  onToggleCollapse,
  collapsedIds,
  onUpdateData,
}) {
  const [panelTab, setPanelTab] = useState('ids');
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

      <section className="panel-list-section">
        <div className="panel-tabs" role="tablist" aria-label="Selection details">
          <button
            className={panelTab === 'ids' ? 'active' : ''}
            role="tab"
            aria-selected={panelTab === 'ids'}
            onClick={() => setPanelTab('ids')}
          >
            All IDs
          </button>
          <button
            className={panelTab === 'data' ? 'active' : ''}
            role="tab"
            aria-selected={panelTab === 'data'}
            onClick={() => setPanelTab('data')}
          >
            Data
          </button>
        </div>

        {panelTab === 'ids' ? (
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
        ) : selected ? (
          <div className="tile-data-panel">
            <div className="tile-data-id">{selected.id}</div>
            {DATA_ROW_TITLES.map((title, index) => (
              <label className="tile-data-row" key={`${selected.id}-data-${index}`}>
                <span>{title}</span>
                <input
                  type="text"
                  value={selected.dataRows?.[index] ?? ''}
                  placeholder="Enter a value"
                  onChange={(event) => {
                    const nextRows = Array.from(
                      { length: DATA_ROW_TITLES.length },
                      (_, rowIndex) => selected.dataRows?.[rowIndex] ?? '',
                    );
                    nextRows[index] = event.target.value;
                    onUpdateData(selected.id, nextRows);
                  }}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Select a tile to view its data.</p>
        )}
      </section>
    </aside>
  );
}
