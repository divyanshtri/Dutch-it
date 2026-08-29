const ENABLE_UNIVERSAL_PARSER = false;

function Fab({ onQuickExpense, onScanReceipt, onUniversalParse }) {
  return (
    <div className="fab-group">
      {ENABLE_UNIVERSAL_PARSER && onUniversalParse && (
        <button className="fab-ghost-clay" onClick={onUniversalParse} title="Parse Invoice">
          <span className="material-symbols-outlined">document_scanner</span>
        </button>
      )}
      <button className="fab-ghost-clay" onClick={onScanReceipt} title="Scan Receipt">
        <span className="material-symbols-outlined">photo_camera</span>
      </button>
      <button className="fab-clay" onClick={onQuickExpense} title="Add Expense">
        <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
      </button>
    </div>
  );
}
export default Fab;
