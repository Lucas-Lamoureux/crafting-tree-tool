export default function BoundaryNode({ data }) {
  return (
    <section className="tree-boundary">
      <header className="tree-boundary-header">
        <strong>{data.title}</strong>
        <span>Inputs: {formatList(data.inputs)}</span>
        <span>Outputs: {formatList(data.outputs)}</span>
      </header>
    </section>
  );
}

function formatList(items = []) {
  if (items.length === 0) {
    return 'none';
  }

  return items.join(', ');
}
