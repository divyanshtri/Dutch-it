import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function CreateGroup({ onGroupCreated, onCancel }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-select current logged-in user ID upon mount/auth load
  useEffect(() => {
    if (user?._id) {
      setSelectedMembers((prev) =>
        prev.includes(user._id) ? prev : [...prev, user._id]
      );
    }
  }, [user]);

  // Fetch only the logged-in user's friend list
  useEffect(() => {
    async function fetchFriends() {
      try {
        const res = await fetch('http://localhost:5000/api/friends', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load friends');
        const data = await res.json();
        setFriends(data);
      } catch (err) {
        setError('Could not load friends.');
      } finally {
        setIsLoadingFriends(false);
      }
    }
    fetchFriends();
  }, []);

  function toggleMember(userId) {
    // Prevent unchecking yourself from group membership
    if (userId === user?._id) return;

    setSelectedMembers((prevSelected) => {
      if (prevSelected.includes(userId)) {
        return prevSelected.filter((id) => id !== userId);
      } else {
        return [...prevSelected, userId];
      }
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }
    if (selectedMembers.length === 0) {
      setError('Select at least one member.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:5000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, members: selectedMembers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create group.');
      }

      onGroupCreated();
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
        <h2 className="section-title">New Group</h2>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="group-name">
            Group Name
          </label>
          <input
            id="group-name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Goa Trip Squad"
          />
        </div>

        <div className="form-field">
          <span className="form-label">Members</span>

          {isLoadingFriends ? (
            <p className="status-text">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="status-text">
              You haven't added any friends yet. Go to the Friends tab to add
              some first.
            </p>
          ) : (
            <div className="member-select-list">
              {friends.map((friend) => (
                <label key={friend._id} className="member-select-row">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(friend._id)}
                    onChange={() => toggleMember(friend._id)}
                  />
                  <span className="member-select-row__name">
                    {friend.fullName}
                  </span>
                  <span className="member-select-row__tags">
                    {friend.email}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="status-text status-text--error">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create Group'}
        </button>
      </form>
    </section>
  );
}

export default CreateGroup;