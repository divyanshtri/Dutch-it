// src/components/ReceiptScannerModal.jsx
import { useState, useEffect } from 'react';
import ReceiptUpload from './ReceiptUpload';
import { calculateSplit } from '../utils/calculateSplit';

// Local helper — mirrors CreateExpense.jsx's blankLineItem, but this
// component maps AI-parsed items into the same shape rather than starting
// from a blank row, so both places stay compatible with the same backend
// payload contract.
function mapReceiptItem(item) {
  return {
    id: crypto.randomUUID(),
    itemName: item.itemName,
    price: item.price,
    quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
    dietaryTag: item.dietaryTag,
    isAlcohol: item.isAlcohol,
  };
}

function ReceiptScannerModal({ onClose, onCreated }) {
  // ----- STEP CONTROL -----
  const [step, setStep] = useState(1); // 1: select group, 2: scan, 3: itemize + submit

  // ----- STEP 1 STATE -----
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [group, setGroup] = useState(null); // full populated group, fetched on selection
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingGroupDetail, setIsLoadingGroupDetail] = useState(false);

  // ----- STEP 3 STATE (populated once the receipt is parsed) -----
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [vegMembers, setVegMembers] = useState([]);
  const [nonVegMembers, setNonVegMembers] = useState([]);
  const [alcoholMembers, setAlcoholMembers] = useState([]);

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----- FETCH THE USER'S GROUPS, ON MOUNT -----
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('http://localhost:5000/api/groups', { credentials: 'include' });
        const data = await res.json();
        setGroups(data);
      } catch {
        setError('Could not load your groups.');
      } finally {
        setIsLoadingGroups(false);
      }
    }
    fetchGroups();
  }, []);

  // ----- STEP 1 -> fetch full group detail once a group is picked -----
  async function handleSelectGroup(id) {
    setGroupId(id);
    setGroup(null);
    if (!id) return;

    setIsLoadingGroupDetail(true);
    try {
      const res = await fetch(`http://localhost:5000/api/groups/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load group details.');
      const data = await res.json();
      setGroup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingGroupDetail(false);
    }
  }

  // ----- STEP 2 -> receipt parsed, populate step 3's state and advance -----
  function handleParsed(receiptData) {
    setDescription(receiptData.merchantName);
    setLineItems(receiptData.lineItems.map(mapReceiptItem));
    setStep(3);
  }

  // ----- GENERIC POOL TOGGLE, same pattern as CreateExpense -----
  function togglePoolMember(setPool, userId) {
    setPool((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function updateLineItem(id, field, value) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeLineItem(id) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  // ----- LIVE SPLIT PREVIEW, derived on every render -----
  const totalAmount = lineItems.reduce(
    (sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)),
    0
  );
  const { balances, allMembers } = calculateSplit(lineItems, vegMembers, nonVegMembers, alcoholMembers);

  function nameById(id) {
    return group?.members.find((m) => m._id === id)?.fullName || 'Unknown';
  }

  async function handleSubmit() {
    setError(null);

    if (!description.trim() || !paidBy || lineItems.length === 0) {
      setError('Description, payer, and at least one item are required.');
      return;
    }
    if (lineItems.some((item) => !item.itemName.trim() || !parseFloat(item.price))) {
      setError('Every item needs a name and a price greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          group: groupId,
          description,
          totalAmount,
          paidBy,
          splitType: 'itemized',
          vegMembers,
          nonVegMembers,
          alcoholMembers,
          lineItems: lineItems.map(({ id, ...rest }) => ({
            ...rest,
            price: parseFloat(rest.price),
            quantity: parseInt(rest.quantity) || 1,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save expense.');
      }

      onCreated();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-panel ${step === 3 ? 'modal-panel--fullscreen' : 'modal-panel--wide'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== STEP 1: SELECT GROUP ===== */}
        {step === 1 && (
          <div className="form">
            <h3 className="subsection-title">Select a Group</h3>

            {isLoadingGroups ? (
              <p className="status-text">Loading groups…</p>
            ) : (
              <div className="form-field">
                <select
                  className="form-input"
                  value={groupId}
                  onChange={(e) => handleSelectGroup(e.target.value)}
                >
                  <option value="">Choose a group…</option>
                  {groups.map((g) => (
                    <option key={g._id} value={g._id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isLoadingGroupDetail && <p className="status-text">Loading members…</p>}
            {error && <p className="status-text status-text--error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!group}
                onClick={() => setStep(2)}
              >
                Next: Scan Receipt
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 2: SCAN RECEIPT ===== */}
        {step === 2 && (
          <div className="form">
            <h3 className="subsection-title">Scan Receipt</h3>
            <ReceiptUpload onParsed={handleParsed} />

            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>← Back</button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: ITEMIZED SPLIT (2-COLUMN GRID) ===== */}
        {step === 3 && group && (
          <div className="scanner-split-layout">
            {/* ===== LEFT COLUMN: MAIN FORM ===== */}
            <div className="scanner-split-layout__main">
              <h3 className="subsection-title">Review &amp; Split</h3>

              <div className="form-field">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Paid By</label>
                <select className="form-input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  <option value="">Select who paid</option>
                  {group.members.map((m) => (
                    <option key={m._id} value={m._id}>{m.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="pools-grid">
                {[
                  { label: 'Vegetarian', pool: vegMembers, setPool: setVegMembers },
                  { label: 'Non-Vegetarian', pool: nonVegMembers, setPool: setNonVegMembers },
                  { label: 'Drinking Alcohol', pool: alcoholMembers, setPool: setAlcoholMembers },
                ].map(({ label, pool, setPool }) => (
                  <div key={label} className="member-pool">
                    <span className="member-pool__label">{label}</span>
                    <div className="member-pool__list">
                      {group.members.map((m) => (
                        <label key={m._id} className="member-pool__row">
                          <input
                            type="checkbox"
                            checked={pool.includes(m._id)}
                            onChange={() => togglePoolMember(setPool, m._id)}
                          />
                          <span>{m.fullName}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-field">
                <span className="form-label">Items</span>
                <div className="line-items">
                  <div className="line-item-row line-item-row--header">
                    <span>Item</span><span>Price</span><span>Qty</span><span>Diet</span><span>Alcohol</span><span />
                  </div>
                  {lineItems.map((item) => (
                    <div key={item.id} className="line-item-row">
                      <input
                        type="text"
                        className="form-input form-input--compact"
                        value={item.itemName}
                        onChange={(e) => updateLineItem(item.id, 'itemName', e.target.value)}
                      />
                      <input
                        type="number"
                        className="form-input form-input--compact"
                        value={item.price}
                        onChange={(e) => updateLineItem(item.id, 'price', e.target.value)}
                      />
                      <input
                        type="number"
                        className="form-input form-input--compact"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                        min="1"
                      />
                      <select
                        className="form-input form-input--compact"
                        value={item.dietaryTag}
                        onChange={(e) => updateLineItem(item.id, 'dietaryTag', e.target.value)}
                      >
                        <option value="veg">Veg</option>
                        <option value="non-veg">Non-veg</option>
                        <option value="neutral">Neutral</option>
                      </select>
                      <label className="line-item-row__checkbox">
                        <input
                          type="checkbox"
                          checked={item.isAlcohol}
                          onChange={(e) => updateLineItem(item.id, 'isAlcohol', e.target.checked)}
                        />
                      </label>
                      <button
                        type="button"
                        className="remove-row-btn"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="status-text status-text--error">{error}</p>}
            </div>

            {/* ===== RIGHT COLUMN: STICKY SPLIT PREVIEW + ACTIONS ===== */}
            <div className="scanner-split-layout__sidebar">
              <div className="preview-block">
                <h3 className="subsection-title">Split Preview</h3>
                <div className="preview-total">
                  <span>Total</span>
                  <span className="preview-total__amount">₹{totalAmount.toFixed(2)}</span>
                </div>
                {allMembers.length === 0 ? (
                  <p className="status-text">Assign members to a dietary pool to see the split.</p>
                ) : (
                  <div className="balances-list">
                    {allMembers.map((id) => (
                      <div key={id} className="balance-row">
                        <span className="balance-row__names">{nameById(id)}</span>
                        <span className="balance-row__amount">₹{(balances[id] || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="scanner-split-layout__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setStep(2)}>← Rescan</button>
                <button type="button" className="btn btn--primary" disabled={isSubmitting} onClick={handleSubmit}>
                  {isSubmitting ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReceiptScannerModal;