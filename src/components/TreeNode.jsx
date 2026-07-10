import { Handle, Position } from '@xyflow/react';

const handlePositions = {
  right: {
    target: Position.Left,
    source: Position.Right,
    targetClass: 'node-handle-left',
    sourceClass: 'node-handle-right',
  },
  left: {
    target: Position.Right,
    source: Position.Left,
    targetClass: 'node-handle-right',
    sourceClass: 'node-handle-left',
  },
  down: {
    target: Position.Top,
    source: Position.Bottom,
    targetClass: 'node-handle-top',
    sourceClass: 'node-handle-bottom',
  },
  up: {
    target: Position.Bottom,
    source: Position.Top,
    targetClass: 'node-handle-bottom',
    sourceClass: 'node-handle-top',
  },
};

const blockSides = [
  { side: 'left', position: Position.Left, className: 'node-handle-left' },
  { side: 'right', position: Position.Right, className: 'node-handle-right' },
  { side: 'up', position: Position.Top, className: 'node-handle-top' },
  { side: 'down', position: Position.Bottom, className: 'node-handle-bottom' },
];

const DEFAULT_TILE_WIDTH = 55;
const TILE_LABEL_PADDING = 26;
const AVERAGE_CHARACTER_WIDTH = 7.4;

function getTileWidth(data) {
  if (data.isBlock || data.isFrame) {
    return data.width;
  }

  return Math.max(
    DEFAULT_TILE_WIDTH,
    Math.ceil(String(data.id).length * AVERAGE_CHARACTER_WIDTH + TILE_LABEL_PADDING),
  );
}

export default function TreeNode({ data, selected }) {
  const handles = handlePositions[data.layoutDirection] ?? handlePositions.right;
  const tileWidth = getTileWidth(data);
  const selectTile = (event, id) => {
    event.stopPropagation();
    data.onSelectTile?.(id, event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
  };

  const openTileMenu = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    data.onSelectTile?.(id, event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
    data.onOpenTileMenu?.({ id, x: event.clientX, y: event.clientY });
  };

  const tileClassName = (id, extraClass = '') => [
    'frame-tile',
    extraClass,
    data.selectedIds?.has(id) ? 'is-selected' : '',
    'nodrag',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={[
        'tree-node',
        selected ? 'is-selected' : '',
        data.selected ? 'is-highlighted' : '',
        data.collapsed ? 'is-collapsed' : '',
        data.isIngredientPickerParent ? 'is-picker-parent' : '',
        data.isIngredientPickerTarget ? 'is-picker-target' : '',
        data.ingredientCount > 0 ? `has-check-status is-check-${data.ingredientCheckStatus}` : '',
        data.isFrame ? 'is-frame' : '',
      ].filter(Boolean).join(' ')}
      title={data.description || data.id}
      style={{
        width: tileWidth,
        height: data.height,
      }}
    >
      {data.isBlock || data.isFrame ? (
        blockSides.map(({ side, position, className }) => (
          <Handle
            key={`target-${side}`}
            id={`target-${side}`}
            className={`node-handle node-handle-in ${className}`}
            type="target"
            position={position}
            data-side={side}
          />
        ))
      ) : (
        <Handle
          className={`node-handle node-handle-in ${handles.targetClass}`}
          type="target"
          position={handles.target}
        />
      )}
      <label className="node-check nodrag" title="Toggle checked" onPointerDown={(event) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={data.checked}
          onChange={() => data.onToggleChecked?.(data.id)}
          onClick={(event) => event.stopPropagation()}
        />
      </label>
      {data.isFrame ? (
        <div className="frame-layout">
          <strong className="frame-title">{data.frameTitle || data.id}</strong>
          <div className="frame-section frame-section-middle">
            {data.frameNetwork?.items?.length > 0 ? (
              <div className="frame-network">
                <svg className="frame-network-edges" aria-hidden="true">
                  <defs>
                    <marker id="frame-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#9ab0a8" />
                    </marker>
                  </defs>
                  {data.frameNetwork.inputSeparatorX != null && (
                    <line
                      className="frame-network-separator"
                      x1={data.frameNetwork.inputSeparatorX}
                      y1="0"
                      x2={data.frameNetwork.inputSeparatorX}
                      y2="100%"
                    />
                  )}
                  {data.frameNetwork.outputSeparatorX != null && (
                    <line
                      className="frame-network-separator"
                      x1={data.frameNetwork.outputSeparatorX}
                      y1="0"
                      x2={data.frameNetwork.outputSeparatorX}
                      y2="100%"
                    />
                  )}
                  {data.frameNetwork.edges.map((edge) => (
                    <line key={edge.id} className="frame-network-edge" x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} />
                  ))}
                </svg>
                {data.frameNetwork.items.map((tile) => (
                  <span
                    className={tileClassName(tile.id, 'frame-network-tile')}
                    key={tile.id}
                    style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => selectTile(event, tile.id)}
                    onContextMenu={(event) => openTileMenu(event, tile.id)}
                  >
                    {tile.id}
                    {tile.ioRole && <span className="frame-tile-io">{tile.ioRole}</span>}
                  </span>
                ))}
              </div>
            ) : data.frameContents?.length > 0
              ? data.frameContents.map((tile) => (
                <span
                  className={tileClassName(tile.id)}
                  key={tile.id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => selectTile(event, tile.id)}
                  onContextMenu={(event) => openTileMenu(event, tile.id)}
                >
                  {tile.id}
                </span>
              ))
              : 'Middle'}
          </div>
        </div>
      ) : (
        <strong>{data.id}</strong>
      )}
      {data.ingredientCount > 0 && (
        <span className="node-badge">{data.collapsed ? '+' : data.ingredientCount}</span>
      )}
      {(data.ioRole || data.boundaryRole) && (
        <span className="node-io-marker">{data.ioRole || data.boundaryRole}</span>
      )}
      {data.isBlock || data.isFrame ? (
        blockSides.map(({ side, position, className }) => (
          <Handle
            key={`source-${side}`}
            id={`source-${side}`}
            className={`node-handle node-handle-out ${className}`}
            type="source"
            position={position}
            data-side={side}
          />
        ))
      ) : (
        <Handle
          className={`node-handle node-handle-out ${handles.sourceClass}`}
          type="source"
          position={handles.source}
        />
      )}
    </div>
  );
}
