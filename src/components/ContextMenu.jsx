import { useEffect, useState } from 'react';

export default function ContextMenu({ menu, node, onAction, onClose, onDescriptionChange }) {
  const [description, setDescription] = useState('');

  useEffect(() => {
    setDescription(node?.description ?? '');
  }, [node?.description, node?.id]);

  if (!menu) {
    return null;
  }

  return (
    <>
      <button className="menu-scrim" aria-label="Close context menu" onClick={onClose} />
      <div
        className="context-menu"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <label className="context-description">
          <span>Description</span>
          <textarea
            value={description}
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => onDescriptionChange(menu.id, description)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Add a note"
          />
        </label>
        <button onClick={(event) => handleAction(event, 'add', onAction)}>Add Ingredient</button>
        <button onClick={(event) => handleAction(event, 'remove', onAction)}>Remove Ingredient</button>
        <button onClick={(event) => handleAction(event, 'rename', onAction)}>Rename</button>
        <button className="danger" onClick={(event) => handleAction(event, 'delete', onAction)}>Delete</button>
      </div>
    </>
  );
}

function handleAction(event, action, onAction) {
  event.preventDefault();
  event.stopPropagation();
  onAction(action);
}
