import SearchBar from './SearchBar.jsx';

export default function Toolbar({
  nodeCount,
  edgeCount,
  onSearch,
  onSave,
  onLoad,
  onAddNode,
  onAddTextBlock,
  onFit,
  fileInputRef,
}) {
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">D</span>
        <div>
          <h1>Dependency Tree Explorer</h1>
          <p>{nodeCount} IDs · {edgeCount} links</p>
        </div>
      </div>

      <SearchBar onSearch={onSearch} />

      <div className="toolbar-actions">
        <button onClick={onAddNode}>Add Tile</button>
        <button onClick={onAddTextBlock}>Add Text</button>
        <button onClick={onFit}>Fit</button>
        <button onClick={onSave}>Save JSON</button>
        <button onClick={() => fileInputRef.current?.click()}>Load JSON</button>
        <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={onLoad} />
      </div>
    </header>
  );
}
