import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CreateExpense from './CreateExpense';
import RecordSettlement from './RecordSettlement';
import Fab from './Fab';
import SimpleExpenseModal from './SimpleExpenseModal';
import DetailSkeleton from './skeletons/DetailSkeleton';
import FriendSkeleton from './skeletons/FriendSkeleton';
import Avatar from './Avatar';
import GhostBadge from './GhostBadge';
import ShareSummaryModal from './ShareSummaryModal';
import { API_BASE_URL } from '../api';

function GroupDetail({ groupId, onBack }) {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [error, setError] = useState(null);

  // Nudge Confirmation state (holds the recipient's name or null)
  const [nudgeConfirm, setNudgeConfirm] = useState(null);

  // Legacy full-page expense creator toggle
  const [showCreateExpense, setShowCreateExpense] = useState(false);

  // Modal-based Expense states (via FAB)
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [initialScanMode, setInitialScanMode] = useState(false);

  // Settlement & Member states
  const [settlingDebt, setSettlingDebt] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberMode, setMemberMode] = useState('friend');
  const [ghostForm, setGhostForm] = useState({ name: '', phone: '', email: '' });
  const [isAddingGhost, setIsAddingGhost] = useState(false);
  const [showShare, setShowShare] = useState(false);

  async function fetchGroupData() {
    try {
      setIsLoading(true);
      const [groupRes, balancesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/groups/${groupId}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/groups/${groupId}/balances`, { credentials: 'include' }),
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

  // Fetch friends and open the add-member modal
  async function openAddMember() {
    setShowAddMember(true);
    setIsLoadingFriends(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load friends.');
      const data = await res.json();
      setFriends(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingFriends(false);
    }
  }

  // Pass friendId on click and update local group state from backend JSON response
  async function handleAddMember(friendId) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: friendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add member');

      setGroup(data); // backend returns the updated, populated group directly
      setShowAddMember(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddGhost(event) {
    event.preventDefault();
    setError(null);
    setIsAddingGhost(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}/ghost-member`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(ghostForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add guest member.');
      setGhostForm({ name: '', phone: '', email: '' });
      setShowAddMember(false);
      await fetchGroupData();
    } catch (err) { setError(err.message); }
    finally { setIsAddingGhost(false); }
  }

  async function handleDeleteGroup() {
    if (!window.confirm(`Delete "${group.name}" permanently? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/groups/${groupId}`, {
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

  async function handleNudge(toUserId, toUserName, amount) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/nudges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupId, toUserId, amount }),
      });
      if (!res.ok) throw new Error('Failed to send nudge.');
      setNudgeConfirm(toUserName); // trigger confirmation modal
    } catch (err) {
      setError(err.message);
    }
  }

  // FAB Click Handlers
  function handleOpenQuickExpense() {
    setInitialScanMode(false);
    setShowSimpleModal(true);
  }

  function handleOpenScanReceipt() {
    setInitialScanMode(true);
    setShowSimpleModal(true);
  }

  if (isLoading) return <DetailSkeleton />;
  if (error) return <p className="status-text status-text--error">{error}</p>;
  if (!group) return null;

  // Legacy itemized full-page creation mode
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

  // Derived list: friends minus anyone already in the group using .toString() comparison
  const eligibleFriends = friends.filter(
    (friend) => !group.members.some((member) => member._id.toString() === friend._id.toString())
  );

  return (
    <section>
      <button className="back-link" onClick={onBack}>
        ← All groups
      </button>

      <div className="section-header">
        <h2 className="section-title">
          {group.name}{' '}
          <span className="section-count">
            ({group.members.length} member{group.members.length !== 1 ? 's' : ''})
          </span>
        </h2>
        <div className="section-header__actions">
          <button className="btn btn--ghost btn--nav" onClick={openAddMember}>
            + Add Member
          </button>
          <button className="btn btn--ghost btn--nav" onClick={() => setShowCreateExpense(true)}>
            + Itemized Split
          </button>
          <button className="btn btn--ghost btn--nav" onClick={() => setShowShare(true)}>
            Share Summary
          </button>
          <button className="btn btn--ghost btn--nav" onClick={handleDeleteGroup}>
            Delete Group
          </button>
        </div>
      </div>

      {/* ----- MEMBERS ROW ----- */}
      <div className="members-row">
        {group.members.map((member) => (
          <span key={member._id} className="member-chip">
            <Avatar user={member} size={20} /> {member.fullName || member.name || 'Unknown'} {member.isGhost && <GhostBadge />}
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
                  <strong>{nameById[debt.owes]}</strong> owes <strong>{nameById[debt.owedTo]}</strong>
                </span>
                <span className="balance-row__right">
                  <span className="balance-row__amount">₹{debt.amount.toFixed(2)}</span>

                  {user?._id === debt.owedTo && (
                    <button
                      className="btn btn--ghost btn--small"
                      onClick={() => handleNudge(debt.owes, nameById[debt.owes], debt.amount)}
                    >
                      Nudge
                    </button>
                  )}

                  <button className="btn btn--ghost btn--small" onClick={() => setSettlingDebt(debt)}>
                    Settle Up
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----- FLOATING ACTION BUTTON ----- */}
      <Fab
        onQuickExpense={handleOpenQuickExpense}
        onScanReceipt={handleOpenScanReceipt}
      />

      {/* ----- SIMPLE EXPENSE MODAL ----- */}
      {showSimpleModal && (
        <SimpleExpenseModal
          group={group}
          initialScan={initialScanMode}
          onClose={() => setShowSimpleModal(false)}
          onCreated={() => {
            setShowSimpleModal(false);
            fetchGroupData();
          }}
        />
      )}

      {/* ----- NUDGE CONFIRMATION MODAL ----- */}
      {nudgeConfirm && (
        <div className="modal-backdrop" onClick={() => setNudgeConfirm(null)}>
          <div className="modal-panel modal-panel--small" onClick={(e) => e.stopPropagation()}>
            <h3 className="subsection-title">Reminded!</h3>
            <p className="status-text" style={{ marginBottom: '1.5rem' }}>
              <strong>{nudgeConfirm}</strong> has been notified.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setNudgeConfirm(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- ADD MEMBER MODAL ----- */}
      {showAddMember && (
        <div className="modal-backdrop" onClick={() => setShowAddMember(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="subsection-title">Add Member</h3>

            <div className="split-tabs">
              <button type="button" className={`split-tab ${memberMode === 'friend' ? 'split-tab--active' : ''}`} onClick={() => setMemberMode('friend')}>Existing Friend</button>
              <button type="button" className={`split-tab ${memberMode === 'ghost' ? 'split-tab--active' : ''}`} onClick={() => setMemberMode('ghost')}>Create Guest</button>
            </div>

            {memberMode === 'friend' && (isLoadingFriends ? (
              <FriendSkeleton rows={3} />
            ) : eligibleFriends.length === 0 ? (
              <p className="status-text">No eligible friends to add.</p>
            ) : (
              <div className="member-select-list">
                {eligibleFriends.map((friend) => (
                  <div
                    key={friend._id}
                    className="member-select-row"
                    onClick={() => handleAddMember(friend._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="member-select-row__name">{friend.fullName}</span>
                    <span className="member-select-row__tags">{friend.email}</span>
                  </div>
                ))}
              </div>
            ))}

            {memberMode === 'ghost' && <form className="form ghost-member-form" onSubmit={handleAddGhost}>
              <div className="form-field"><label className="form-label">Name</label><input className="form-input" required value={ghostForm.name} onChange={(e) => setGhostForm((form) => ({ ...form, name: e.target.value }))} placeholder="Guest name" /></div>
              <div className="form-field"><label className="form-label">Mobile (optional)</label><input className="form-input" value={ghostForm.phone} onChange={(e) => setGhostForm((form) => ({ ...form, phone: e.target.value }))} placeholder="+919876543210" /></div>
              <div className="form-field"><label className="form-label">Email (optional)</label><input className="form-input" type="email" value={ghostForm.email} onChange={(e) => setGhostForm((form) => ({ ...form, email: e.target.value }))} placeholder="guest@example.com" /></div>
              <button className="btn btn--primary" disabled={isAddingGhost}>{isAddingGhost ? 'Adding…' : 'Add without Account'}</button>
            </form>}

            <div className="modal-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowAddMember(false)}>
                Close
              </button>
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

      {showShare && <ShareSummaryModal groupId={groupId} onClose={() => setShowShare(false)} />}
    </section>
  );
}

export default GroupDetail;
