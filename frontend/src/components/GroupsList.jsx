import { useState, useEffect } from 'react';

// 1. We accept the onSelectGroup prop here from App.jsx
function GroupsList({ onSelectGroup }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const response = await fetch('http://localhost:5000/api/groups');

        if (!response.ok) {
          throw new Error('Failed to fetch groups from the server.');
        }

        const data = await response.json();
        setGroups(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGroups();
  }, []);

  if (isLoading) {
    return <p className="status-text">Loading groups…</p>;
  }

  if (error) {
    return <p className="status-text status-text--error">{error}</p>;
  }

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">Your Groups</h2>
        <span className="section-count">{groups.length}</span>
      </div>

      {groups.length === 0 ? (
        <p className="status-text">No groups yet. Create one to get started.</p>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            // 2. Wired the click handler directly to this card block
            <div
              key={group._id}
              className="group-card"
              onClick={() => onSelectGroup(group._id)}
              style={{ cursor: 'pointer' }}
            >
              <h3 className="group-card__name">{group.name}</h3>
              <p className="group-card__meta">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default GroupsList;