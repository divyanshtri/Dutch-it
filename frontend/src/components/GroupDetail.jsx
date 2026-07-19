import { useState, useEffect } from 'react';
import CreateExpense from './CreateExpense';
import RecordSettlement from './RecordSettlement';

function GroupDetail({ groupId, onBack }) {
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateExpense, setShowCreateExpense] = useState(false); // <- Toggle state for the Create Expense view
  const [settlingDebt, setSettlingDebt] = useState(null); 

  // Named function so we can manually run a re-fetch after a new expense is successfully saved
  async function fetchGroupData() {
    try {
      setIsLoading(true); // reset to true in case we're switching FROM another group
      const [groupRes, balancesRes] = await Promise.all([
        fetch(`http://localhost:5000/api/groups/${groupId}`),
        fetch(`http://localhost:5000/api/groups/${groupId}/balances`),
      ]);

      if (!groupRes.ok || !balancesRes.ok) {
        throw new Error('Failed to load group details.');
      }

      const groupData = await groupRes.json();
      const balancesData = await balancesRes.json();

      setGroup(groupData);
      setBalances(balancesData.balances);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchGroupData();
    // [groupId] dependency ensures we re-fetch if we click into a different group
  }, [groupId]);

  if (isLoading) return <p className="status-text">Loading group…</p>;
  if (error) return <p className="status-text status-text--error">{error}</p>;
  if (!group) return null;

  // Show the Create Expense form in place of the detail view when active
  if (showCreateExpense) {
    return (
      <CreateExpense
        group={group}
        onCancel={() => setShowCreateExpense(false)}
        onExpenseCreated={() => {
          setShowCreateExpense(false);
          fetchGroupData(); // re-fetch so the new balances update instantly
        }}
      />
    );
  }

  // Build lookup mapping user IDs to names
  const nameById = {};
  group.members.forEach((member) => {
    nameById[member._id] = member.name;
  });

  return (
    <section>
      <button className="back-link" onClick={onBack}>
        ← All groups
      </button>

      <div className="section-header">
        <h2 className="section-title">{group.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="section-count">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </span>
          <button className="btn btn--primary" onClick={() => setShowCreateExpense(true)}>
            + Add Expense
          </button>
        </div>
      </div>

      {/* ----- MEMBERS ROW ----- */}
      <div className="members-row">
        {group.members.map((member) => (
          <span key={member._id} className="member-chip">
            {member.name}
          </span>
        ))}
      </div>

      {/* ----- BALANCES ----- */}
      <div className="balances-block">
        <h3 className="subsection-title">Balances</h3>

        {balances.length === 0 ? (
          <p className="status-text">Everyone is settled up.</p>
        ) : (
          <div className="balances-list">
            {balances.map((debt, index) => (
              <div key={index} className="balance-row">
                <span className="balance-row__names">
                  <strong>{nameById[debt.owes]}</strong> owes{' '}
                  <strong>{nameById[debt.owedTo]}</strong>
                </span>
                <span className="balance-row__right">
                  <span className="balance-row__amount">₹{debt.amount.toFixed(2)}</span>
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => setSettlingDebt(debt)}
                  >
                    Settle Up
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {settlingDebt && (
        <RecordSettlement
          groupId={groupId}
          debt={settlingDebt}
          nameById={nameById}
          onCancel={() => setSettlingDebt(null)}
          onSettled={() => {
            setSettlingDebt(null);
            fetchGroupData(); // re-fetch so the balance list reflects the new state instantly
          }}
        />
      )}
    </section>
  );
}

export default GroupDetail;