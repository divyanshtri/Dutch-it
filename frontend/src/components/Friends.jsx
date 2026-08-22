import { useState, useRef, useEffect } from 'react';
import FriendSkeleton from './skeletons/FriendSkeleton';
import Avatar from './Avatar';
import { API_BASE_URL } from '../api';

function UserPlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  );
}

function MoreVertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

function FriendRow({ friend, onUnfriend }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="surface-panel friend-tile">
      <Avatar user={friend} size={44} />
      <div className="friend-tile__stack">
        <span className="friend-tile__name">{friend.fullName}</span>
        <span className="friend-tile__email">{friend.email}</span>
      </div>

      <div className="friend-tile__menu-wrap" ref={menuRef}>
        <button
          className="icon-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Friend options"
        >
          <MoreVertIcon />
        </button>
        {menuOpen && (
          <div className="glass-panel friend-tile__menu">
            <button
              className="btn btn--ghost btn--small"
              style={{ width: '100%' }}
              onClick={() => {
                onUnfriend(friend._id);
                setMenuOpen(false);
              }}
            >
              Unfriend
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Friends() {
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  async function fetchFriends() {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/friends`, {
        credentials: 'include',
      });
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load friends.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFriends();
  }, []);

  async function handleAddFriend(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!identifier.trim()) {
      setError('Enter an email or phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add friend.');

      setSuccessMsg(data.message);
      setIdentifier('');
      setShowAddForm(false);
      fetchFriends();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnfriend(friendId) {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove friend.');
      fetchFriends();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">
          Friends <span className="section-count">({friends.length})</span>
        </h2>
        <button
          className="icon-btn icon-btn--accent"
          onClick={() => setShowAddForm((prev) => !prev)}
          aria-label="Add friend"
        >
          <UserPlusIcon />
        </button>
      </div>

      {showAddForm && (
        <form className="friends-add-row" onSubmit={handleAddFriend}>
          <input
            type="text"
            className="input-flat"
            placeholder="Friend's email or phone number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="btn-accent"
            disabled={isSubmitting}
            aria-label="Submit add friend"
          >
            Add
          </button>
        </form>
      )}

      {error && <p className="status-text status-text--error" style={{ marginBottom: '16px' }}>{error}</p>}
      {successMsg && (
        <p className="status-text status-text--success" style={{ marginBottom: '16px' }}>{successMsg}</p>
      )}

      {isLoading ? (
        <FriendSkeleton />
      ) : friends.length === 0 ? (
        <p className="status-text">
          No friends yet. Add someone by email or phone above.
        </p>
      ) : (
        <div className="friends-list">
          {friends.map((friend) => (
            <FriendRow
              key={friend._id}
              friend={friend}
              onUnfriend={handleUnfriend}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default Friends;