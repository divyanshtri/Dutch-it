import { useState, useEffect } from 'react';

function SimpleExpenseModal({ onClose, onCreated, onNewGroup }) {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [group, setGroup] = useState(null); // Full group object with populated members

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equally');
  const [selected, setSelected] = useState([]);
  const [customAmounts, setCustomAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available groups
  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('http://localhost:5000/api/groups', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    }
    fetchGroups();
  }, []);

  // Fetch full details (populated members) when a group is picked
  async function handleSelectGroup(id) {
    setGroupId(id);
    if (!id) {
      setGroup(null);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/groups/${id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setGroup(data);
        setSelected(data.members ? data.members.map((m) => m._id) : []);
        setPaidBy('');
        setCustomAmounts({});
        setPercentages({});
      }
    } catch (err) {
      setError('Failed to fetch group members.');
    }
  }

  const total = parseFloat(amount) || 0;
  const members = group?.members || [];

  // Compute splits array based on chosen tab mode
  function computeSplits() {
    if (splitType === 'equally') {
      const per = selected.length ? total / selected.length : 0;
      return selected.map((id) => ({
        user: id,
        amount: Math.round(per * 100) / 100,
      }));
    }
    if (splitType === 'unequally') {
      return members
        .filter((m) => parseFloat(customAmounts[m._id]) > 0)
        .map((m) => ({
          user: m._id,
          amount: parseFloat(customAmounts[m._id]),
        }));
    }
    // Percentage
    return members
      .filter((m) => parseFloat(percentages[m._id]) > 0)
      .map((m) => ({
        user: m._id,
        percentage: parseFloat(percentages[m._id]),
        amount:
          Math.round(
            total * (parseFloat(percentages[m._id]) / 100) * 100
          ) / 100,
      }));
  }

  const splits = computeSplits();
  const unequalSum =
    splitType === 'unequally'
      ? splits.reduce((s, x) => s + x.amount, 0)
      : 0;
  const pctSum =
    splitType === 'percentage'
      ? splits.reduce((s, x) => s + (x.percentage || 0), 0)
      : 0;

  // Strict validation rules
  const isUnequalValid =
    splitType !== 'unequally' || Math.abs(unequalSum - total) <= 0.01;
  const isPercentageValid =
    splitType !== 'percentage' || Math.abs(pctSum - 100) <= 0.01;
  const hasSplits = splits.length > 0;
  const canSubmit =
    Boolean(group) &&
    Boolean(description.trim()) &&
    Boolean(paidBy) &&
    total > 0 &&
    hasSplits &&
    isUnequalValid &&
    isPercentageValid;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!group) {
      setError('Select a group first.');
      return;
    }
    if (!description.trim() || !paidBy || !total) {
      setError('Description, payer, and amount are required.');
      return;
    }
    if (!isUnequalValid) {
      setError(
        `Amounts add up to ₹${unequalSum.toFixed(2)}, not ₹${total.toFixed(2)}.`
      );
      return;
    }
    if (!isPercentageValid) {
      setError(`Percentages add up to ${pctSum.toFixed(1)}%, not 100%.`);
      return;
    }
    if (!hasSplits) {
      setError('Select at least one person to split with.');
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
          totalAmount: total,
          paidBy,
          splitType,
          splits,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create expense');

      onCreated();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel modal-panel--wide"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="subsection-title">Add Expense</h3>

        <form className="form" onSubmit={handleSubmit}>
          {/* ----- GROUP SELECTION CARDS ----- */}
          <div className="form-field">
            <label className="form-label">Group</label>

            {groups.length === 0 ? (
              <div className="groups-tile-grid">
                <div
                  className="group-tile group-tile--add"
                  onClick={() => {
                    onClose();
                    onNewGroup?.();
                  }}
                >
                  <span className="group-tile--add__plus">+</span>
                  <span className="group-tile__meta">Add Group</span>
                </div>
              </div>
            ) : (
              <div className="fab-group-picker">
                {groups.map((g) => (
                  <div
                    key={g._id}
                    className={`fab-group-card ${
                      groupId === g._id ? 'fab-group-card--selected' : ''
                    }`}
                    onClick={() => handleSelectGroup(g._id)}
                  >
                    <span className="fab-group-card__icon">
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="fab-group-card__name">{g.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {group && (
            <>
              <div className="form-field">
                <input
                  className="form-input"
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-field">
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="form-field">
                <select
                  className="form-input"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                >
                  <option value="">Paid by…</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.fullName || m.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Split Type Tabs */}
              <div className="split-tabs">
                {['equally', 'unequally', 'percentage'].map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`split-tab ${
                      splitType === t ? 'split-tab--active' : ''
                    }`}
                    onClick={() => setSplitType(t)}
                  >
                    {t === 'equally'
                      ? 'Equally'
                      : t === 'unequally'
                      ? 'Unequally'
                      : 'By Percentages'}
                  </button>
                ))}
              </div>

              {/* Equal Split Selection */}
              {splitType === 'equally' &&
                members.map((m) => (
                  <label key={m._id} className="member-select-row">
                    <input
                      type="checkbox"
                      checked={selected.includes(m._id)}
                      onChange={() =>
                        setSelected((prev) =>
                          prev.includes(m._id)
                            ? prev.filter((id) => id !== m._id)
                            : [...prev, m._id]
                        )
                      }
                    />
                    <span className="member-select-row__name">
                      {m.fullName || m.name || 'Unknown'}
                    </span>
                    {selected.includes(m._id) && (
                      <span className="member-select-row__tags">
                        ₹{(total / (selected.length || 1)).toFixed(2)}
                      </span>
                    )}
                  </label>
                ))}

              {/* Unequal Split Selection */}
              {splitType === 'unequally' && (
                <>
                  {members.map((m) => (
                    <div key={m._id} className="split-row">
                      <span>{m.fullName || m.name || 'Unknown'}</span>
                      <input
                        type="number"
                        step="any"
                        className="form-input form-input--compact"
                        placeholder="0"
                        value={customAmounts[m._id] || ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [m._id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}

                  {(() => {
                    const remaining = total - unequalSum;
                    const remainingPct = total > 0 ? (remaining / total) * 100 : 0;
                    return (
                      <p
                        className={`status-text ${
                          !isUnequalValid ? 'status-text--error' : ''
                        }`}
                      >
                        ₹{unequalSum.toFixed(2)} of ₹{total.toFixed(2)} assigned{' '}
                        <span>
                          (₹{remaining.toFixed(2)} left, {remainingPct.toFixed(1)}% left)
                        </span>
                      </p>
                    );
                  })()}
                </>
              )}

              {/* Percentage Split Selection */}
              {splitType === 'percentage' && (
                <>
                  {members.map((m) => (
                    <div key={m._id} className="split-row">
                      <span>{m.fullName || m.name || 'Unknown'}</span>
                      <input
                        type="number"
                        step="any"
                        className="form-input form-input--compact"
                        placeholder="0"
                        value={percentages[m._id] || ''}
                        onChange={(e) =>
                          setPercentages((prev) => ({
                            ...prev,
                            [m._id]: e.target.value,
                          }))
                        }
                      />
                      <span className="status-text">
                        ₹
                        {(
                          (total * (parseFloat(percentages[m._id]) || 0)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {(() => {
                    const remainingPct = 100 - pctSum;
                    const remainingAmount = total > 0 ? (total * remainingPct) / 100 : 0;
                    return (
                      <p
                        className={`status-text ${
                          !isPercentageValid ? 'status-text--error' : ''
                        }`}
                      >
                        {pctSum.toFixed(1)}% of 100%{' '}
                        <span>
                          (₹{remainingAmount.toFixed(2)} left, {remainingPct.toFixed(1)}% left)
                        </span>
                      </p>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {error && <p className="status-text status-text--error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting || !canSubmit}
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SimpleExpenseModal;