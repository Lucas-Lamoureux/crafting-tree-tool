import SearchBar from './SearchBar.jsx';

const EDIT_VERSION = 20;

export default function Toolbar({
  nodeCount,
  edgeCount,
  onSearch,
  onSave,
  onLoad,
  onImport,
  onAddNode,
  onAddBlock,
  onAddBoundary,
  onFit,
  fileInputRef,
  importInputRef,
}) {
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">D</span>
        <div>
          <h1>
            Dependency Tree Explorer
            <span className="edit-version">#{EDIT_VERSION}</span>
          </h1>
          <p>{nodeCount} IDs · {edgeCount} links</p>
        </div>
      </div>

      <SearchBar onSearch={onSearch} />

      <div className="toolbar-actions">
        <button onClick={onAddNode}>Add Tile</button>
        <button onClick={onAddBlock}>Add Block</button>
        <button onClick={onAddBoundary}>Add Boundary</button>
        <button onClick={onFit}>Fit</button>
        <button onClick={onSave}>Save JSON</button>
        <button onClick={() => fileInputRef.current?.click()}>Load JSON</button>
        <button onClick={() => importInputRef.current?.click()}>Import JSON</button>
        <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={onLoad} />
        <input ref={importInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={onImport} />
      </div>
    </header>
  );
}
