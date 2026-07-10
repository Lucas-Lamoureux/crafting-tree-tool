import { useEffect, useRef, useState } from 'react';

let fallbackRowId = 0;

function makeRow() {
  return {
    key: typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ingredient-row-${fallbackRowId += 1}`,
    value: '',
  };
}

export default function AddIngredientsModal({ open, parentId, nodesById, onCancel, onCreate }) {
  const [rows, setRows] = useState(() => [makeRow()]);
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setRows([makeRow()]);
      window.requestAnimationFrame(() => firstInputRef.current?.focus());
    }
  }, [open]);

  if (!open || !parentId) {
    return null;
  }

  const parent = nodesById[parentId];
  const parentIngredientIds = new Set(parent?.ingredients ?? []);
  const normalizedRows = rows.map((row) => row.value.trim());
  const filledRows = normalizedRows.filter(Boolean);
  const duplicateRows = new Set(
    filledRows.filter((id, index) => filledRows.indexOf(id) !== index),
  );
  const existingIngredientRows = new Set(
    filledRows.filter((id) => parentIngredientIds.has(id)),
  );
  const hasErrors = filledRows.length === 0 || duplicateRows.size > 0 || existingIngredientRows.size > 0;

  function updateRow(key, value) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, makeRow()]);
  }

  function removeRow(key) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (hasErrors) {
      return;
    }

    onCreate(parentId, filledRows);
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={onCancel}>
      <form
        className="tile-modal ingredient-modal"
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Add Ingredients</h2>
          <button type="button" aria-label="Close" onClick={onCancel}>x</button>
        </header>

        <div className="ingredient-modal-parent">For {parentId}</div>

        <div className="ingredient-rows">
          {rows.map((row, index) => {
            const normalizedId = row.value.trim();
            const isDuplicate = duplicateRows.has(normalizedId);
            const isAlreadyIngredient = existingIngredientRows.has(normalizedId);

            return (
              <label key={row.key} className="ingredient-row">
                <span>Name</span>
                <input
                  ref={index === 0 ? firstInputRef : null}
                  value={row.value}
                  onChange={(event) => updateRow(row.key, event.target.value)}
                  placeholder="Ingredient ID"
                  aria-label={`Ingredient ${index + 1} name`}
                />
                <button type="button" onClick={() => removeRow(row.key)} disabled={rows.length === 1}>
                  Remove
                </button>
                {isDuplicate && <em>Duplicate row.</em>}
                {isAlreadyIngredient && <em>Already an ingredient.</em>}
              </label>
            );
          })}
        </div>

        <button type="button" className="secondary-action" onClick={addRow}>Add another ingredient</button>

        {filledRows.length === 0 && <p className="modal-error">Enter at least one ingredient name.</p>}

        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" disabled={hasErrors}>Create Ingredients</button>
        </footer>
      </form>
    </div>
  );
}
