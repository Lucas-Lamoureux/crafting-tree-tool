import { useEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;

function clampSize(value, fallback) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return fallback;
  }

  return Math.min(600, Math.max(90, Math.round(size)));
}

export default function FrameModal({
  open,
  existingIds,
  onCancel,
  onSubmit,
  itemLabel = 'Frame',
}) {
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState(String(DEFAULT_WIDTH));
  const [height, setHeight] = useState(String(DEFAULT_HEIGHT));
  const firstInputRef = useRef(null);
  const normalizedTitle = title.trim();
  const duplicate = normalizedTitle && existingIds.has(normalizedTitle);
  const widthValue = clampSize(width, DEFAULT_WIDTH);
  const heightValue = clampSize(height, DEFAULT_HEIGHT);
  const canSubmit = normalizedTitle && !duplicate;

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle('');
    setWidth(String(DEFAULT_WIDTH));
    setHeight(String(DEFAULT_HEIGHT));
    window.requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      id: normalizedTitle,
      title: normalizedTitle,
      width: widthValue,
      height: heightValue,
    });
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onCancel}>
      <form className="tile-modal block-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>Add {itemLabel}</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>x</button>
        </header>

        <label>
          <span>{itemLabel} Title</span>
          <input
            ref={firstInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter a unique title"
            aria-label={`${itemLabel} title`}
          />
        </label>

        <div className="block-size-grid">
          <label>
            <span>Total Width px</span>
            <input
              type="number"
              min="90"
              max="600"
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              aria-label={`${itemLabel} total width in pixels`}
            />
          </label>
          <label>
            <span>Total Height px</span>
            <input
              type="number"
              min="90"
              max="600"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              aria-label={`${itemLabel} total height in pixels`}
            />
          </label>
        </div>

        {duplicate && <p className="modal-error">That title already exists.</p>}

        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!canSubmit}>Create {itemLabel}</button>
        </footer>
      </form>
    </div>
  );
}
