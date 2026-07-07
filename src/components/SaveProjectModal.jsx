import { useEffect, useRef, useState } from 'react';

export default function SaveProjectModal({ open, defaultName, onCancel, onSave }) {
  const [filename, setFilename] = useState(defaultName);
  const inputRef = useRef(null);
  const normalizedFilename = normalizeFilename(filename);

  useEffect(() => {
    if (open) {
      setFilename(defaultName);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [defaultName, open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!normalizedFilename) {
      return;
    }

    onSave(normalizedFilename);
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onCancel}>
      <form
        className="tile-modal"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Save Project</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>x</button>
        </header>

        <label>
          <span>File name</span>
          <input
            ref={inputRef}
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            placeholder="project-name.json"
            aria-label="File name"
          />
        </label>

        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={!normalizedFilename}>Save</button>
        </footer>
      </form>
    </div>
  );
}

function normalizeFilename(value) {
  const clean = value.trim().replace(/[<>:"/\\|?*]+/g, '-');

  if (!clean) {
    return '';
  }

  return clean.toLowerCase().endsWith('.json') ? clean : `${clean}.json`;
}
