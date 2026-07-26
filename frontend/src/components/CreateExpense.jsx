import { useState } from 'react';
import { calculateSplit } from '../utils/calculateSplit';
import ReceiptUpload from './ReceiptUpload';

// A blank line item template — used both for the initial row and every
// time "+ Add Item" is clicked.
function blankLineItem() {
  return {
    id: crypto.randomUUID(), // stable local key
    itemName: '',
    price: '',
    quantity: 1,
    dietaryTag: 'neutral',
    isAlcohol: false,
  };
}

function CreateExpense({ group, onExpenseCreated, onCancel }) {
  // `group.members` is already the full list of populated user objects
  const availableMembers = group.members;

  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [vegMembers, setVegMembers] = useState([]);
  const [nonVegMembers, setNonVegMembers] = useState([]);
  const [alcoholMembers, setAlcoholMembers] = useState([]);
  const [lineItems, setLineItems] = useState([blankLineItem()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ----- AI RECEIPT PARSING HANDLER -----
  function handleReceiptParsed(receiptData) {
    if (!receiptData) return;
    
    const mappedItems = receiptData.lineItems.map((item) => ({
      id: crypto.randomUUID(),
      itemName: item.itemName,
      price: item.price,
      quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
      dietaryTag: item.dietaryTag,
      isAlcohol: item.isAlcohol,
    }));

    setLineItems(mappedItems);
    setDescription(receiptData.merchantName);
  }

  // ----- GENERIC POOL TOGGLE -----
  function togglePoolMember(setPool, userId) {
    setPool((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  // ----- LINE ITEM ROW MANAGEMENT -----
  function addLineItem() {
    setLineItems((prev) => [...prev, blankLineItem()]);
  }

  function removeLineItem(id) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateLineItem(id, field, value) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // ----- LIVE CALCULATION -----
  const totalAmount = lineItems.reduce(
    (sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)),
    0
  );
  const { balances, allMembers } = calculateSplit(
    lineItems,
    vegMembers,
    nonVegMembers,
    alcoholMembers
  );

  // UPDATED: Name lookup with fallback
  function nameById(id) {
    const member = availableMembers.find((m) => m._id === id);
    return member?.fullName || member?.name || 'Unknown';
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
          group: group._id,
          description,
          totalAmount,
          paidBy,
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
        throw new Error(data.message || 'Failed to create expense.');
      }

      onExpenseCreated();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <button className="back-link" onClick={onCancel}>
        ← Cancel
      </button>

      <div className="section-header">
        <h2 className="section-title">New Expense</h2>
      </div>

      <form className="form form--wide" onSubmit={handleSubmit}>
        
        {/* ===== REAL AI RECEIPT UPLOAD OVERLAY ===== */}
        <ReceiptUpload onParsed={handleReceiptParsed} />

        <div className="form-field">
          <label className="form-label" htmlFor="expense-desc">Description</label>
          <input
            id="expense-desc"
            type="text"
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Dinner at Barbeque Nation"
          />
        </div>

        {/* UPDATED: Payer dropdown options */}
        <div className="form-field">
          <label className="form-label" htmlFor="paid-by">Paid By</label>
          <select
            id="paid-by"
            className="form-input"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            <option value="">Select who paid</option>
            {availableMembers.map((m) => (
              <option key={m._id} value={m._id}>
                {m.fullName || m.name || 'Unknown'}
              </option>
            ))}
          </select>
        </div>

        {/* ===== DIETARY POOLS ===== */}
        <div className="pools-grid">
          <MemberPool
            label="Vegetarian"
            members={availableMembers}
            selected={vegMembers}
            onToggle={(id) => togglePoolMember(setVegMembers, id)}
          />
          <MemberPool
            label="Non-Vegetarian"
            members={availableMembers}
            selected={nonVegMembers}
            onToggle={(id) => togglePoolMember(setNonVegMembers, id)}
          />
          <MemberPool
            label="Drinking Alcohol"
            members={availableMembers}
            selected={alcoholMembers}
            onToggle={(id) => togglePoolMember(setAlcoholMembers, id)}
          />
        </div>

        {/* ===== LINE ITEMS ===== */}
        <div className="form-field">
          <span className="form-label">Items</span>

          <div className="line-items">
            <div className="line-item-row line-item-row--header">
              <span>Item</span>
              <span>Price</span>
              <span>Qty</span>
              <span>Diet</span>
              <span>Alcohol</span>
              <span />
            </div>

            {lineItems.map((item) => (
              <div key={item.id} className="line-item-row">
                <input
                  type="text"
                  className="form-input form-input--compact"
                  value={item.itemName}
                  onChange={(e) => updateLineItem(item.id, 'itemName', e.target.value)}
                  placeholder="Item name"
                />
                <input
                  type="number"
                  className="form-input form-input--compact"
                  value={item.price}
                  onChange={(e) => updateLineItem(item.id, 'price', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <input
                  type="number"
                  className="form-input form-input--compact"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                  min="1"
                  step="1"
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

          <button type="button" className="btn btn--ghost" onClick={addLineItem}>
            + Add Item
          </button>
        </div>

        {/* ===== LIVE SPLIT PREVIEW ===== */}
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

        {error && <p className="status-text status-text--error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Expense'}
        </button>
      </form>
    </section>
  );
}

{/* UPDATED: MemberPool sub-component with fallback */}
function MemberPool({ label, members, selected, onToggle }) {
  return (
    <div className="member-pool">
      <span className="member-pool__label">{label}</span>
      <div className="member-pool__list">
        {members.map((m) => (
          <label key={m._id} className="member-pool__row">
            <input
              type="checkbox"
              checked={selected.includes(m._id)}
              onChange={() => onToggle(m._id)}
            />
            <span>{m.fullName || m.name || 'Unknown'}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default CreateExpense;