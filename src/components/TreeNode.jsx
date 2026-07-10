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

function getFrameArrowPoints(edge) {
  const angle = Math.atan2(edge.y2 - edge.y1, edge.x2 - edge.x1);
  const midX = (edge.x1 + edge.x2) / 2;
  const midY = (edge.y1 + edge.y2) / 2;
  const size = 7;
  const backX = midX - Math.cos(angle) * size;
  const backY = midY - Math.sin(angle) * size;
  const sideX = Math.sin(angle) * size * 0.55;
  const sideY = -Math.cos(angle) * size * 0.55;
  return `${midX},${midY} ${backX + sideX},${backY + sideY} ${backX - sideX},${backY - sideY}`;
}

function getTileWidth(data) {
  if (data.isBlock || data.isFrame) {
    return data.width;
  }

  return Math.max(
    DEFAULT_TILE_WIDTH,
    Math.ceil(String(data.id).length * AVERAGE_CHARACTER_WIDTH + TILE_LABEL_PADDING),
  );
}

function FramePreview({ item, data, onSelect, onOpenMenu }) {
  const select = (event, id) => {
    event.stopPropagation();
    onSelect(id, event.ctrlKey || event.metaKey || event.shiftKey ? 'toggle' : 'replace');
  };

  const openMenu = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    select(event, id);
    onOpenMenu(event, id);
  };

  return (
    <div
      className="frame-preview"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => select(event, item.id)}
      onContextMenu={(event) => openMenu(event, item.id)}
    >
      <strong className="frame-preview-title">{item.frameTitle || item.id}</strong>
      <div className="frame-preview-content">
        {(item.frameNetwork?.items ?? []).map((child) => (
          child.isFrame ? (
            <FramePreview
              key={child.id}
              item={child}
              data={data}
              onSelect={onSelect}
              onOpenMenu={onOpenMenu}
            />
          ) : (
            <span
              className={tileClassNameForPreview(child.id, data)}
              key={child.id}
              style={{ left: child.x, top: child.y, width: child.width, height: child.height }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => select(event, child.id)}
              onContextMenu={(event) => openMenu(event, child.id)}
            >
              {child.id}
            </span>
          )
        ))}
      </div>
    </div>
  );
}

function tileClassNameForPreview(id, data) {
  return [
    'frame-tile',
    'frame-preview-tile',
    data.selectedIds?.has(id) ? 'is-selected' : '',
    'nodrag',
  ].filter(Boolean).join(' ');
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
                  {(data.frameNetwork.sectionSeparators ?? []).map((x) => (
                    <line
                      className="frame-network-separator"
                      key={`section-${x}`}
                      x1={x}
                      y1="0"
                      x2={x}
                      y2="100%"
                    />
                  ))}
                  {data.frameNetwork.edges.map((edge) => (
                    <g key={edge.id}>
                      {(() => {
                        const isParentConnection = data.selectedIds?.has(edge.target);
                        const isIngredientConnection = data.selectedIds?.has(edge.source);
                        const edgeClass = [
                          'frame-network-edge',
                          isParentConnection ? 'is-parent-connection' : '',
                          isIngredientConnection ? 'is-ingredient-connection' : '',
                        ].filter(Boolean).join(' ');
                        const arrowClass = [
                          'frame-network-arrow',
                          isParentConnection ? 'is-parent-connection' : '',
                          isIngredientConnection ? 'is-ingredient-connection' : '',
                        ].filter(Boolean).join(' ');

                        return (
                          <>
                      <line
                        className={edgeClass}
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        data.onOpenEdgeMenu?.({
                          type: 'edge',
                          edgeId: edge.id,
                          source: edge.source,
                          target: edge.target,
                          x: event.clientX,
                          y: event.clientY,
                        });
                        }}
                      />
                      <polygon className={arrowClass} points={getFrameArrowPoints(edge)} />
                          </>
                        );
                      })()}
                    </g>
                  ))}
                </svg>
                {data.frameNetwork.items.map((tile) => (
                  tile.isFrame ? (
                    <div
                      className="frame-network-tile frame-network-frame"
                      key={tile.id}
                      style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
                    >
                      <FramePreview
                        item={tile}
                        data={data}
                        onSelect={(id, mode) => data.onSelectTile?.(id, mode)}
                        onOpenMenu={(event, id) => openTileMenu(event, id)}
                      />
                    </div>
                  ) : (
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
                  )
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
