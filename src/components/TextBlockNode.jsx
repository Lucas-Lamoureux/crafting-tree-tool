export default function TextBlockNode({ data, selected }) {
  function updateSize(event) {
    const box = event.currentTarget;
    data.onUpdate?.(data.id, {
      width: Math.round(box.offsetWidth),
      height: Math.round(box.offsetHeight),
    });
  }

  return (
    <section
      className={`text-block-node ${selected || data.selected ? 'is-highlighted' : ''}`}
      style={{
        width: data.width,
        height: data.height,
      }}
      onMouseUp={updateSize}
    >
      <div className="text-block-header">
        <input
          className="nodrag"
          value={data.title}
          onChange={(event) => data.onUpdate?.(data.id, { title: event.target.value })}
          aria-label="Text block name"
        />
        <div className="text-block-font nodrag">
          <button type="button" onClick={() => data.onUpdate?.(data.id, { fontSize: Math.max(10, data.fontSize - 1) })}>-</button>
          <span>{data.fontSize}</span>
          <button type="button" onClick={() => data.onUpdate?.(data.id, { fontSize: Math.min(48, data.fontSize + 1) })}>+</button>
        </div>
      </div>

      <textarea
        className="text-block-body nodrag"
        value={data.text}
        style={{ fontSize: data.fontSize }}
        onChange={(event) => data.onUpdate?.(data.id, { text: event.target.value })}
        aria-label="Text block contents"
        placeholder="Notes..."
      />
    </section>
  );
}
