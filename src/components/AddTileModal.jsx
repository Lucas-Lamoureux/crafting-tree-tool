import { useEffect, useRef, useState } from 'react';

export default function AddTileModal({ open, existingIds, onCancel, onCreate }) {
  const [id, setId] = useState('');
  const inputRef = useRef(null);
  const normalizedId = id.trim();
  const duplicate = normalizedId && existingIds.has(normalizedId);

  useEffect(() => {
    if (open) {
      setId('');
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!normalizedId || duplicate) {
      return;
    }

    onCreate(normalizedId);
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onCancel}>
      <form
        className="tile-modal"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Add Tile</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>x</button>
        </header>

        <label>
          <span>Tile ID</span>
          <input
            ref={inputRef}
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="Enter a unique ID"
            aria-label="Tile ID"
          />
        </label>

        {duplicate && <p className="modal-error">That ID already exists.</p>}

        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!normalizedId || duplicate}>Create</button>
        </footer>
      </form>
    </div>
  );
}
