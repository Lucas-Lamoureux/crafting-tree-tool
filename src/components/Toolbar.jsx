import SearchBar from './SearchBar.jsx';

const EDIT_VERSION = 30;

export default function Toolbar({
  nodeCount,
  edgeCount,
  onSearch,
  onSave,
  onLoad,
  onImport,
  onAddNode,
  onAddBlock,
  onAddFrame,
  dataEnabled,
  onToggleData,
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
        <details className="add-menu">
          <summary>Add</summary>
          <div className="add-menu-options">
            <button onClick={onAddNode}>Tile</button>
            <button onClick={onAddBlock}>Block</button>
            <button onClick={onAddFrame}>Frame</button>
          </div>
        </details>
        <button
          className={dataEnabled ? 'toggle-button is-active' : 'toggle-button'}
          aria-pressed={dataEnabled}
          onClick={onToggleData}
        >
          Data
        </button>
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
