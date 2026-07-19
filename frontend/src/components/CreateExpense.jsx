import { useState } from 'react';
import { calculateSplit } from '../utils/calculateSplit';

// A blank line item template — used both for the initial row and every
// time "+ Add Item" is clicked. Centralizing this shape in one place means
// if you add a field later (e.g. a `guestOwnerId` for temporary profiles),
// you only update it here.
function blankLineItem() {
  return {
    id: crypto.randomUUID(), // a stable local key, since these rows have no DB _id yet
    itemName: '',
    price: '',
    dietaryTag: 'neutral',
    isAlcohol: false,
  };
}

function CreateExpense({ group, onExpenseCreated, onCancel }) {
  // `group.members` is already the full list of populated user objects,
  // passed down from GroupDetail. Calling this `availableMembers` (rather
  // than just using group.members everywhere) is a deliberate seam: when
  // guest/temporary profiles exist later, this is the one spot that would
  // merge real members + temp guests into a single list — nothing else in
  // this component needs to change.
  const availableMembers = group.members;

  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [vegMembers, setVegMembers] = useState([]);
  const [nonVegMembers, setNonVegMembers] = useState([]);
  const [alcoholMembers, setAlcoholMembers] = useState([]);
  const [lineItems, setLineItems] = useState([blankLineItem()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ----- GENERIC POOL TOGGLE -----
  // Instead of writing three near-identical toggle functions (one each for
  // veg/non-veg/alcohol), this one function handles all three by accepting
  // WHICH setter to use. Keeps the logic in one place.
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

  // Updates a single field on a single line item, identified by its local id.
  // .map() rebuilds the whole array, replacing only the matching row —
  // everything else in the array stays untouched. This is the standard
  // React pattern for "update one item inside an array of objects in state."
  function updateLineItem(id, field, value) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  // ----- LIVE CALCULATION -----
  // No useEffect needed here at all. Since this runs directly in the render
  // body, it recalculates automatically on every render — and every state
  // change (typing a price, toggling a checkbox) triggers a render anyway.
  // This is the simplest way to get a "live" preview: just derive it fresh
  // every time, rather than trying to manually track when to recalculate.
  const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  const { balances, allMembers } = calculateSplit(
    lineItems,
    vegMembers,
    nonVegMembers,
    alcoholMembers
  );

  function nameById(id) {
    return availableMembers.find((m) => m._id === id)?.name || 'Unknown';
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
        body: JSON.stringify({
          group: group._id,
          description,
          totalAmount,
          paidBy,
          vegMembers,
          nonVegMembers,
          alcoholMembers,
          // Strip our local-only `id` field before sending — the backend
          // schema doesn't know about it and, thanks to strict: 'throw',
          // would reject the whole request if we sent it as-is.
          lineItems: lineItems.map(({ id, ...rest }) => ({
            ...rest,
            price: parseFloat(rest.price),
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
        {/* ===== FUTURE: OCR RECEIPT UPLOAD ===== */}
        {/* Placeholder zone only for now — no logic wired up. When OCR is
            built, this becomes a real upload input that, on success, calls
            setLineItems() with the parsed items instead of the user typing
            each row manually. Everything below it stays exactly the same,
            since it just operates on `lineItems` state regardless of
            whether a human or an OCR result populated it. */}
        <div className="ocr-placeholder">
          <span className="ocr-placeholder__label">Upload Receipt</span>
          <span className="ocr-placeholder__note">Coming soon — auto-fill items from a photo</span>
        </div>

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
              <option key={m._id} value={m._id}>{m.name}</option>
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

// A small reusable sub-component for the three identical-shaped pool
// selectors (veg / non-veg / alcohol). Pulling this out avoids writing the
// same checkbox-list JSX three times with only the label and state differing.
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
            <span>{m.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default CreateExpense;