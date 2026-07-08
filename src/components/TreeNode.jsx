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

export default function TreeNode({ data, selected }) {
  const handles = handlePositions[data.layoutDirection] ?? handlePositions.right;

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
      ].filter(Boolean).join(' ')}
      title={data.description || data.id}
      style={{
        width: data.width,
        height: data.height,
      }}
    >
      {data.isBlock ? (
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
      <strong>{data.id}</strong>
      {data.ingredientCount > 0 && (
        <span className="node-badge">{data.collapsed ? '+' : data.ingredientCount}</span>
      )}
      {data.isBlock ? (
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
