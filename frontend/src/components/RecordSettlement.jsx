import { useState } from 'react';

// `debt` is one row from the balances array: { owes, owedTo, amount }
// `nameById` is the same lookup object GroupDetail already builds — reused
// here rather than re-fetched, since GroupDetail already has it in memory.
function RecordSettlement({ groupId, debt, nameById, onSettled, onCancel }) {
  // Pre-fill the amount with the full owed amount — the most common case
  // is someone paying back exactly what they owe. The user can still edit
  // this down for a partial payment, same as your original stress test.
  const [amount, setAmount] = useState(debt.amount.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:5000/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          groupId,
          payerId: debt.owes,      // the person paying money back
          receiverId: debt.owedTo, // the person receiving it
          amount: parsedAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to record settlement.');
      }

      onSettled(); // parent closes the form and re-fetches balances
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    // A lightweight backdrop + centered panel, kept in the same sharp,
    // hairline-bordered language as the rest of the app rather than a
    // generic rounded modal with a drop shadow.
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3 className="subsection-title">Settle Up</h3>

        <p className="settle-summary">
          <strong>{nameById[debt.owes]}</strong> pays{' '}
          <strong>{nameById[debt.owedTo]}</strong>
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="settle-amount">Amount</label>
            <input
              id="settle-amount"
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              max={debt.amount}
              autoFocus
            />
            <span className="form-hint">Owed: ₹{debt.amount.toFixed(2)}</span>
          </div>

          {error && <p className="status-text status-text--error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Recording…' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecordSettlement;