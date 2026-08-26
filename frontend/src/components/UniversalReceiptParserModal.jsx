import { useRef, useState } from 'react';
import { API_BASE_URL } from '../api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function DetailBlock({ title, details }) {
  const visibleDetails = details.filter(([, value]) => value);
  return (
    <article className="universal-card">
      <h4>{title}</h4>
      {visibleDetails.length ? visibleDetails.map(([label, value]) => (
        <p key={label}><span>{label}</span><strong>{value}</strong></p>
      )) : <p className="status-text">Not present on document</p>}
    </article>
  );
}

function money(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function UniversalReceiptParserModal({ onClose }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function parseFile(file) {
    setError('');
    setCopied(false);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }

    const formData = new FormData();
    formData.append('receipt', file);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/receipts/parse-universal`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
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
    } catch {
      setError('Could not access the clipboard.');
    }
  }

  const totals = result?.totals || {};
  const payment = result?.paymentInfo || {};
  const hasPaymentInfo = Object.values(payment).some(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel--fullscreen universal-parser" onClick={(event) => event.stopPropagation()}>
        <div className="universal-parser__header">
          <div>
            <span className="universal-parser__eyebrow">Temporary tool</span>
            <h3 className="subsection-title">Universal Receipt & Tax Invoice Parser</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close parser">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {!result && (
          <div
            className={`ocr-placeholder universal-dropzone ${isDragging ? 'ocr-placeholder--dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              parseFile(event.dataTransfer.files[0]);
            }}
            onClick={() => !isLoading && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => parseFile(event.target.files[0])}
            />
            <span className="material-symbols-outlined universal-dropzone__icon">document_scanner</span>
            <span className="ocr-placeholder__label">
              {isLoading ? 'Reading every detail…' : 'Drop a receipt or invoice here'}
            </span>
            <span className="ocr-placeholder__note">
              {isLoading ? 'Gemini is extracting structured metadata.' : 'JPEG, PNG or WEBP · up to 10 MB'}
            </span>
            {isLoading && <span className="universal-loader" aria-hidden="true" />}
          </div>
        )}

        {error && <p className="status-text status-text--error universal-parser__error">{error}</p>}

        {result && (
          <div className="universal-results">
            <div className="universal-detail-grid">
              <DetailBlock title="Merchant" details={[
                ['Name', result.merchant?.name], ['Address', result.merchant?.address],
                ['GSTIN', result.merchant?.gstin], ['PAN', result.merchant?.pan],
              ]} />
              <DetailBlock title="Customer" details={[
                ['Name', result.customer?.name], ['Address', result.customer?.address],
                ['GSTIN', result.customer?.gstin],
              ]} />
              <DetailBlock title="Invoice" details={[
                ['Number', result.invoiceDetails?.invoiceNumber], ['Date', result.invoiceDetails?.invoiceDate],
                ['Due date', result.invoiceDetails?.dueDate], ['Place of supply', result.invoiceDetails?.placeOfSupply],
              ]} />
            </div>

            <section className="universal-card universal-table-card">
              <h4>Line Items</h4>
              <div className="universal-table-wrap">
                <table className="universal-table">
                  <thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>List price</th><th>Tax</th><th>Amount</th></tr></thead>
                  <tbody>
                    {(result.lineItems || []).map((item, index) => (
                      <tr key={`${item.srNo}-${index}`}>
                        <td>{item.description || '—'}</td><td>{item.hsnSac || '—'}</td>
                        <td>{item.quantity} {item.unit}</td><td>₹{money(item.listPrice)}</td>
                        <td>{Number(item.taxPercent || 0)}%</td><td>₹{money(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!result.lineItems?.length && <p className="status-text">No line items detected.</p>}
              </div>
            </section>

            <div className="universal-summary-grid">
              <article className="universal-card universal-totals">
                <h4>Totals</h4>
                <p><span>Subtotal</span><strong>₹{money(totals.subtotal)}</strong></p>
                <p><span>CGST</span><strong>₹{money(totals.cgst)}</strong></p>
                <p><span>SGST</span><strong>₹{money(totals.sgst)}</strong></p>
                <p><span>IGST</span><strong>₹{money(totals.igst)}</strong></p>
                <p><span>Total tax</span><strong>₹{money(totals.totalTax)}</strong></p>
                <p className="universal-totals__grand"><span>Grand total</span><strong>₹{money(totals.grandTotal)}</strong></p>
                {totals.grandTotalInWords && <small>{totals.grandTotalInWords}</small>}
              </article>
              {hasPaymentInfo && <DetailBlock title="Payment & Bank" details={[
                ['Bank', payment.bankName], ['Account', payment.accountNumber],
                ['IFSC', payment.ifscCode], ['Branch', payment.branch],
              ]} />}
            </div>
          </div>
        )}

        <div className="modal-actions universal-parser__actions">
          {result && <button className="btn btn--ghost" onClick={() => setResult(null)}>Parse Another</button>}
          {result && <button className="btn btn--primary" onClick={copyJson}>{copied ? 'Copied!' : 'Copy JSON'}</button>}
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default UniversalReceiptParserModal;
