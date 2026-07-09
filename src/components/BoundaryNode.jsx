export default function BoundaryNode({ data }) {
  return (
    <section className="tree-boundary boundary-drag-handle">
      <strong>{data.title}</strong>
      <span>Frame</span>
    </section>
  );
}
