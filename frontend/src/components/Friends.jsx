import { useState, useEffect } from 'react';

function Friends() {
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchFriends() {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:5000/api/friends', { credentials: 'include' });
      const data = await res.json();
      setFriends(data);
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
      const res = await fetch('http://localhost:5000/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to add friend.');

      setSuccessMsg(data.message);
      setIdentifier('');
      fetchFriends(); // refresh the list so the new friend shows up immediately
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Friends</h2>
        <span className="section-count">{friends.length}</span>
      </div>

      <form className="form add-friend-form" onSubmit={handleAddFriend}>
        <input
          type="text"
          className="form-input"
          placeholder="Friend's email or phone number"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add Friend'}
        </button>
      </form>

      {error && <p className="status-text status-text--error">{error}</p>}
      {successMsg && <p className="status-text status-text--success">{successMsg}</p>}

      {isLoading ? (
        <p className="status-text">Loading friends…</p>
      ) : friends.length === 0 ? (
        <p className="status-text">No friends yet. Add someone by email or phone above.</p>
      ) : (
        <div className="member-select-list">
          {friends.map((friend) => (
            <div key={friend._id} className="member-select-row">
              <span className="member-select-row__name">{friend.fullName}</span>
              <span className="member-select-row__tags">{friend.email}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Friends;