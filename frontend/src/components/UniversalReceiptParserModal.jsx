import { useRef, useState } from 'react';
import { API_BASE_URL } from '../api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STANDARD_KEYS = ['documentType', 'headersAndMetadata', 'lineItems', 'totalsAndTaxBreakdown', 'additionalSections', 'unclassifiedData'];

function displayKey(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function DynamicValue({ value, depth = 0 }) {
  if (value === null || value === undefined || value === '') return <span className="universal-empty">Not provided</span>;
  if (typeof value !== 'object') return <strong>{String(value)}</strong>;
  if (Array.isArray(value)) {
    return <div className="universal-array">{value.map((item, index) => (
      <div className="universal-array__item" key={index}><DynamicValue value={item} depth={depth + 1} /></div>
    ))}</div>;
  }
  return <div className={`universal-nested ${depth ? 'universal-nested--inner' : ''}`}>
    {Object.entries(value).map(([key, nestedValue]) => (
      <div className="universal-field" key={key}>
        <span className="universal-field__label">{displayKey(key)}</span>
        <div className="universal-field__value"><DynamicValue value={nestedValue} depth={depth + 1} /></div>
      </div>
    ))}
  </div>;
}

function DynamicSection({ title, data }) {
  if (!data || typeof data !== 'object' || !Object.keys(data).length) return null;
  return <article className="universal-card"><h4>{title}</h4><DynamicValue value={data} /></article>;
}

function DynamicTable({ items }) {
  if (!Array.isArray(items) || !items.length) {
    return <section className="universal-card"><h4>Line Items</h4><p className="status-text">No line-item table detected.</p></section>;
  }
  const objectRows = items.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  if (!objectRows.length) return <DynamicSection title="Line Items" data={items} />;

  const columns = [...new Set(objectRows.flatMap((item) => Object.keys(item)))];
  return <section className="universal-card universal-table-card">
    <h4>Line Items</h4>
    <div className="universal-table-wrap"><table className="universal-table">
      <thead><tr>{columns.map((column) => <th key={column}>{displayKey(column)}</th>)}</tr></thead>
      <tbody>{objectRows.map((item, rowIndex) => <tr key={rowIndex}>{columns.map((column) => (
        <td key={column}><DynamicValue value={item[column]} /></td>
      ))}</tr>)}</tbody>
    </table></div>
  </section>;
}

function UniversalReceiptParserModal({ onClose }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('form');
  const [copied, setCopied] = useState(false);

  async function parseFile(file) {
    setError(''); setCopied(false); setViewMode('form');
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError('Choose a JPEG, PNG, or WEBP image.');
    if (file.size > 10 * 1024 * 1024) return setError('Image must be 10 MB or smaller.');

    const formData = new FormData();
    formData.append('receipt', file);
    setIsLoading(true); setResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/receipts/parse-universal`, {
        method: 'POST', credentials: 'include', body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not parse this document.');
      setResult(data.document);
    } catch (parseError) {
      setError(parseError.message);
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
    } catch { setError('Could not access the clipboard.'); }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-panel modal-panel--fullscreen universal-parser" onClick={(event) => event.stopPropagation()}>
      <div className="universal-parser__header">
        <div><span className="universal-parser__eyebrow">Temporary tool</span><h3 className="subsection-title">Universal Receipt & Tax Invoice Parser</h3></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close parser"><span className="material-symbols-outlined">close</span></button>
      </div>

      {!result && <div
        className={`ocr-placeholder universal-dropzone ${isDragging ? 'ocr-placeholder--dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); parseFile(event.dataTransfer.files[0]); }}
        onClick={() => !isLoading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => parseFile(event.target.files[0])} />
        <span className="material-symbols-outlined universal-dropzone__icon">document_scanner</span>
        <span className="ocr-placeholder__label">{isLoading ? 'Reading every visible detail…' : 'Drop a receipt or invoice here'}</span>
        <span className="ocr-placeholder__note">{isLoading ? 'Gemini is mapping text, tables, and custom sections.' : 'JPEG, PNG or WEBP · up to 10 MB'}</span>
        {isLoading && <span className="universal-loader" aria-hidden="true" />}
      </div>}

      {error && <p className="status-text status-text--error universal-parser__error">{error}</p>}

      {result && <>
        <div className="universal-view-tabs" role="tablist" aria-label="Result view">
          <button className={viewMode === 'form' ? 'universal-view-tab universal-view-tab--active' : 'universal-view-tab'} onClick={() => setViewMode('form')}>Form View</button>
          <button className={viewMode === 'json' ? 'universal-view-tab universal-view-tab--active' : 'universal-view-tab'} onClick={() => setViewMode('json')}>JSON View</button>
        </div>
        {viewMode === 'json' ? <pre className="universal-json"><code>{JSON.stringify(result, null, 2)}</code></pre> : <div className="universal-results">
          {result.documentType && <div className="universal-document-type"><span>Document type</span><strong>{result.documentType}</strong></div>}
          <div className="universal-detail-grid">
            <DynamicSection title="Headers & Metadata" data={result.headersAndMetadata} />
            <DynamicSection title="Totals & Tax Breakdown" data={result.totalsAndTaxBreakdown} />
          </div>
          <DynamicTable items={result.lineItems} />
          <DynamicSection title="Additional Sections" data={result.additionalSections} />
          {Array.isArray(result.unclassifiedData) && result.unclassifiedData.length > 0 && <details className="universal-card universal-unclassified">
            <summary>Unclassified Data <span>{result.unclassifiedData.length}</span></summary>
            <DynamicValue value={result.unclassifiedData} />
          </details>}
          {Object.entries(result).filter(([key]) => !STANDARD_KEYS.includes(key)).map(([key, value]) => (
            <DynamicSection key={key} title={displayKey(key)} data={{ [key]: value }} />
          ))}
        </div>}
      </>}

      <div className="modal-actions universal-parser__actions">
        {result && <button className="btn btn--ghost" onClick={() => setResult(null)}>Parse Another</button>}
        {result && <button className="btn btn--primary" onClick={copyJson}>{copied ? 'Copied!' : 'Copy JSON'}</button>}
        <button className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>;
}

export default UniversalReceiptParserModal;
