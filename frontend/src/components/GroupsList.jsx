import { useState, useEffect } from 'react';
import GroupSkeleton from './skeletons/GroupSkeleton';

function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function GroupsList({ onSelectGroup, searchTerm, onNewGroup, onAddFriend }) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('http://localhost:5000/api/groups', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch groups from the server.');
        const data = await res.json();
        setGroups(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchGroups();
  }, []);

  if (isLoading) return <GroupSkeleton />;
  if (error) return <p className="status-text status-text--error">{error}</p>;

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section>
      <div className="section-header">
        <h2 className="section-title">
          Your Groups <span className="section-count">({filteredGroups.length})</span>
        </h2>
        <div className="section-header__actions">
          <button 
            className="icon-btn icon-btn--accent" 
            onClick={onAddFriend} 
            title="Add Friend"
            aria-label="Add Friend"
          >
            <span className="material-symbols-outlined">person_add</span>
          </button>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        groups.length === 0 ? (
          <div className="groups-tile-grid">
            <div className="group-tile group-tile--add" onClick={onNewGroup}>
              <span className="group-tile--add__plus">+</span>
            </div>
          </div>
        ) : (
          <p className="status-text">No groups match your search.</p>
        )
      ) : (
        <div className="groups-tile-grid">
          {filteredGroups.map((group) => (
            <div
              key={group._id}
              className="surface-panel signature-hero-accent group-tile"
              onClick={() => onSelectGroup(group._id)}
            >
              <span className="group-tile__icon">{group.name.charAt(0).toUpperCase()}</span>
              <span className="group-tile__name">{group.name}</span>
              <span className="group-tile__meta">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </span>
            </div>
          ))}

          {/* Translucent card to add new group */}
          <div className="group-tile group-tile--add" onClick={onNewGroup}>
            <span className="group-tile--add__plus">+</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default GroupsList;