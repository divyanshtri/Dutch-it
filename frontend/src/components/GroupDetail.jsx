import { useState, useEffect } from 'react';
import CreateExpense from './CreateExpense';
import RecordSettlement from './RecordSettlement';

function GroupDetail({ groupId, onBack }) {
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateExpense, setShowCreateExpense] = useState(false);
  const [settlingDebt, setSettlingDebt] = useState(null);

  // Add Member Modal State
  const [showAddMember, setShowAddMember] = useState(false);

  async function fetchGroupData() {
    try {
      setIsLoading(true);
      const [groupRes, balancesRes] = await Promise.all([
        fetch(`http://localhost:5000/api/groups/${groupId}`, { credentials: 'include' }),
        fetch(`http://localhost:5000/api/groups/${groupId}/balances`, { credentials: 'include' }),
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
  }, [groupId]);

  // Fetch friends and open the modal
  async function openAddMember() {
    setShowAddMember(true);
    try {
      const res = await fetch('http://localhost:5000/api/friends', { credentials: 'include' });
      if (res.ok) {
        const friendsData = await res.json();
        setFriends(friendsData);
      }
    } catch (err) {
      console.error('Failed to fetch friends for selection:', err);
    }
  }

  // Directly pass friendId on click and update local group state from backend JSON response
  async function handleAddMember(friendId) {
    try {
      const res = await fetch(`http://localhost:5000/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: friendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add member');

      setGroup(data); // updated, populated group comes straight back from route
      setShowAddMember(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm(`Delete "${group.name}" permanently? This cannot be undone.`)) return;

    try {
      const res = await fetch(`http://localhost:5000/api/groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onBack(); // return to the groups list
    } catch (err) {
      setError(err.message);
    }
  }

  if (isLoading) return <p className="status-text">Loading group…</p>;
  if (error) return <p className="status-text status-text--error">{error}</p>;
  if (!group) return null;

  if (showCreateExpense) {
    return (
      <CreateExpense
        group={group}
        onCancel={() => setShowCreateExpense(false)}
        onExpenseCreated={() => {
          setShowCreateExpense(false);
          fetchGroupData();
        }}
      />
    );
  }

  // Build lookup mapping user IDs to names with full fallbacks
  const nameById = {};
  group.members.forEach((member) => {
    nameById[member._id] = member.fullName || member.name || 'Unknown';
  });

  return (
    <section>
      <button className="back-link" onClick={onBack}>
        ← All groups
      </button>

      <div className="section-header">
        <h2 className="section-title">{group.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="section-count">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </span>
          <button className="btn btn--ghost" onClick={openAddMember}>
            + Add Member
          </button>
          <button className="btn btn--primary" onClick={() => setShowCreateExpense(true)}>
            + Add Expense
          </button>
          <button className="btn btn--ghost" onClick={handleDeleteGroup}>
            Delete Group
          </button>
        </div>
      </div>

      {/* ----- MEMBERS ROW ----- */}
      <div className="members-row">
        {group.members.map((member) => (
          <span key={member._id} className="member-chip">
            {member.fullName || member.name || 'Unknown'}
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

      {/* ----- ADD MEMBER MODAL ----- */}
      {showAddMember && (
        <div className="modal-backdrop" onClick={() => setShowAddMember(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="subsection-title">Add Member</h3>
            <div className="member-select-list">
              {friends
                .filter((f) => !group.members.some((m) => m._id === f._id))
                .map((f) => (
                  <div
                    key={f._id}
                    className="member-select-row"
                    onClick={() => handleAddMember(f._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="member-select-row__name">
                      {f.fullName || f.name || 'Unknown'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ----- SETTLEMENT MODAL ----- */}
      {settlingDebt && (
        <RecordSettlement
          groupId={groupId}
          debt={settlingDebt}
          nameById={nameById}
          onCancel={() => setSettlingDebt(null)}
          onSettled={() => {
            setSettlingDebt(null);
            fetchGroupData();
          }}
        />
      )}
    </section>
  );
}

export default GroupDetail;