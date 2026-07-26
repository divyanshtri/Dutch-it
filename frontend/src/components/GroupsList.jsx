import { useState, useEffect } from 'react';

// 1. We accept onSelectGroup and searchTerm props here
function GroupsList({ onSelectGroup, searchTerm = '' }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        // Include credentials so the HTTP-only auth cookie is sent along
        const response = await fetch('http://localhost:5000/api/groups', { credentials: 'include' });

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

  // Filter groups in real-time as searchTerm changes
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <span className="section-count">{filteredGroups.length}</span>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="status-text">
          {groups.length === 0
            ? 'No groups yet. Create one to get started.'
            : 'No groups match your search.'}
        </p>
      ) : (
        <div className="groups-grid">
          {filteredGroups.map((group) => (
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