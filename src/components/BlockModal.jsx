import { useEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 55;
const DEFAULT_HEIGHT = 32;

function clampSize(value, fallback) {
  const size = Number(value);

  if (!Number.isFinite(size)) {
    return fallback;
  }

  return Math.min(600, Math.max(24, Math.round(size)));
}

export default function BlockModal({
  open,
  mode = 'create',
  existingIds,
  initialBlock,
  onCancel,
  onSubmit,
}) {
  const [id, setId] = useState('');
  const [width, setWidth] = useState(String(DEFAULT_WIDTH));
  const [height, setHeight] = useState(String(DEFAULT_HEIGHT));
  const firstInputRef = useRef(null);
  const normalizedId = id.trim();
  const duplicate = mode === 'create' && normalizedId && existingIds.has(normalizedId);
  const widthValue = clampSize(width, DEFAULT_WIDTH);
  const heightValue = clampSize(height, DEFAULT_HEIGHT);
  const canSubmit = mode === 'edit' || (normalizedId && !duplicate);

  useEffect(() => {
    if (!open) {
      return;
    }

    setId(initialBlock?.id ?? '');
    setWidth(String(initialBlock?.width ?? DEFAULT_WIDTH));
    setHeight(String(initialBlock?.height ?? DEFAULT_HEIGHT));
    window.requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [initialBlock, open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      id: normalizedId || initialBlock?.id,
      width: widthValue,
      height: heightValue,
    });
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onCancel}>
      <form className="tile-modal block-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>{mode === 'edit' ? 'Change Block Size' : 'Add Block'}</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>x</button>
        </header>

        {mode === 'create' ? (
          <label>
            <span>Block ID</span>
            <input
              ref={firstInputRef}
              value={id}
              onChange={(event) => setId(event.target.value)}
              placeholder="Enter a unique ID"
              aria-label="Block ID"
            />
          </label>
        ) : (
          <div className="ingredient-modal-parent">{initialBlock?.id}</div>
        )}

        <div className="block-size-grid">
          <label>
            <span>Width px</span>
            <input
              ref={mode === 'edit' ? firstInputRef : null}
              type="number"
              min="24"
              max="600"
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              aria-label="Block width in pixels"
            />
          </label>
          <label>
            <span>Height px</span>
            <input
              type="number"
              min="24"
              max="600"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              aria-label="Block height in pixels"
            />
          </label>
        </div>

        {duplicate && <p className="modal-error">That ID already exists.</p>}

        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!canSubmit}>{mode === 'edit' ? 'Update Size' : 'Create Block'}</button>
        </footer>
      </form>
    </div>
  );
}
