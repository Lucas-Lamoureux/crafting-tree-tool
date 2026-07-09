import { Handle, Position } from '@xyflow/react';

export default function BoundaryNode({ data }) {
  return (
    <section className="tree-boundary">
      <header className="tree-boundary-header boundary-drag-handle">
        <strong>{data.title}</strong>
        <span>Inputs: {formatList(data.inputs)}</span>
        <span>Outputs: {formatList(data.outputs)}</span>
      </header>
      <div className="boundary-side boundary-side-left">
        {(data.inputs ?? []).map((id, index) => (
          <div key={`input-${id}`} className="boundary-port-row" style={{ top: getPortTop(index, data.inputs.length) }}>
            <Handle
              id={`input-${id}`}
              className="boundary-handle boundary-handle-input"
              type="target"
              position={Position.Left}
            />
            <span>I {id}</span>
          </div>
        ))}
      </div>
      <div className="boundary-side boundary-side-right">
        {(data.outputs ?? []).map((id, index) => (
          <div key={`output-${id}`} className="boundary-port-row" style={{ top: getPortTop(index, data.outputs.length) }}>
            <span>{id} O</span>
            <Handle
              id={`output-${id}`}
              className="boundary-handle boundary-handle-output"
              type="source"
              position={Position.Right}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function formatList(items = []) {
  if (items.length === 0) {
    return 'none';
  }

  return items.join(', ');
}

function getPortTop(index, count) {
  if (count <= 1) {
    return '55%';
  }

  return `${28 + (index / (count - 1)) * 52}%`;
}
