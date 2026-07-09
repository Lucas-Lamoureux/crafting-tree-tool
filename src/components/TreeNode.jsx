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
          <div className="frame-section frame-section-left">Left</div>
          <div className="frame-section frame-section-middle">Middle</div>
          <div className="frame-section frame-section-right">Right</div>
        </div>
      ) : (
        <strong>{data.id}</strong>
      )}
      {data.ingredientCount > 0 && (
        <span className="node-badge">{data.collapsed ? '+' : data.ingredientCount}</span>
      )}
      {data.boundaryRole && (
        <span className="node-io-marker">{data.boundaryRole}</span>
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
