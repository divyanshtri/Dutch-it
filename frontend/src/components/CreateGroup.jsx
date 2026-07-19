import { useState, useEffect } from 'react';

function CreateGroup({ onGroupCreated, onCancel }) {
  // ----- FORM STATE -----
  const [name, setName] = useState('');
  // selectedMembers holds the IDs of checked users. We use an array of
  // strings (not, say, an object of booleans) because that's exactly the
  // shape our POST /api/groups route expects for `members`.
  const [selectedMembers, setSelectedMembers] = useState([]);

  // ----- USERS LIST (to render checkboxes for) -----
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // ----- SUBMISSION STATE -----
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('http://localhost:5000/api/users');
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError('Could not load users.');
      } finally {
        setIsLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  // Toggles a single user ID in/out of the selectedMembers array.
  // This is the standard React pattern for a checkbox group: you never
  // mutate the existing array directly (e.g. selectedMembers.push(id) is
  // WRONG — React won't detect that as a change). Instead you build a
  // brand new array every time and hand that to setSelectedMembers.
  function toggleMember(userId) {
    setSelectedMembers((prevSelected) => {
      if (prevSelected.includes(userId)) {
        // Already selected -> uncheck it: keep everyone EXCEPT this id
        return prevSelected.filter((id) => id !== userId);
      } else {
        // Not selected yet -> check it: keep everyone, plus this new id
        return [...prevSelected, userId];
      }
    });
  }

  async function handleSubmit(e) {
    // Forms submit and reload the whole page by default in plain HTML.
    // preventDefault() stops that, since we want to handle the submission
    // ourselves with fetch() instead and stay on this single-page app.
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
        // createdBy: for now, we default to the first selected member as
        // creator, since we don't have real auth/login yet to know "who is
        // currently using the app." Once you build auth, this will become
        // the logged-in user's ID instead.
        body: JSON.stringify({
          name,
          members: selectedMembers,
          createdBy: selectedMembers[0],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create group.');
      }

      onGroupCreated(); // tell the parent we're done, let it decide what's next
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

          {isLoadingUsers ? (
            <p className="status-text">Loading users…</p>
          ) : (
            <div className="member-select-list">
              {users.map((user) => (
                <label key={user._id} className="member-select-row">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                  />
                  <span className="member-select-row__name">{user.name}</span>
                  <span className="member-select-row__tags">
                    {user.isVegetarian ? 'Veg' : 'Non-veg'}
                    {user.drinksAlcohol ? ' · Drinks' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="status-text status-text--error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Group'}
        </button>
      </form>
    </section>
  );
}

export default CreateGroup;