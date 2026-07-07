import { Handle, Position } from '@xyflow/react';

export default function TreeNode({ data, selected }) {
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
    >
      <Handle className="node-handle node-handle-in" type="target" position={Position.Left} />
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
      <Handle
        className="node-handle node-handle-out"
        type="source"
        position={Position.Right}
      />
    </div>
  );
}
