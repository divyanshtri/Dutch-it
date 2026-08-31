import { useState, useRef } from 'react';
import { API_BASE_URL } from '../api';

// onParsed(receiptData) is called with the structured JSON once Gemini
// successfully returns it — CreateExpense.jsx will eventually use this to
// pre-fill its lineItems state, same seam we discussed for OCR earlier.
function ReceiptUpload({ onParsed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    // FormData is the browser API for building multipart/form-data
    // payloads — required here since we're sending a binary file, not JSON.
    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/receipts/scan`, {
        method: 'POST',
        credentials: 'include',
        // NOTE: deliberately no 'Content-Type' header set here — the
        // browser sets it automatically for FormData, including the
        // required multipart boundary string. Setting it manually would
        // actually break the request.
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to scan receipt.');

      onParsed(data.receipt);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      className={`ocr-placeholder ${isDragging ? 'ocr-placeholder--dragging' : ''} ${isProcessing ? 'ocr-placeholder--processing' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => fileInputRef.current.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {isProcessing ? (
        <>
          <span className="ocr-placeholder__scanline" aria-hidden="true" />
          <span className="ocr-placeholder__label">Reading receipt…</span>
        </>
      ) : (
        <>
          <span className="ocr-placeholder__label">Upload Receipt</span>
          <span className="ocr-placeholder__note">
            Drag a photo here, or click to browse
          </span>
        </>
      )}

      {error && <p className="status-text status-text--error">{error}</p>}
    </div>
  );
}

export default ReceiptUpload;
