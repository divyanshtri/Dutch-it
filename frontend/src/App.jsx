import { useState } from 'react';
import GroupsList from './components/GroupsList';
import GroupDetail from './components/GroupDetail';
import CreateGroup from './components/CreateGroup';

function App() {
  // 'list' | 'detail' | 'create' — one string drives which screen shows.
  // This is a small, hand-rolled version of what a real router (like
  // React Router) will eventually do for you with actual URLs.
  const [view, setView] = useState('list');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  function goToDetail(groupId) {
    setSelectedGroupId(groupId);
    setView('detail');
  }

  function goToList() {
    setSelectedGroupId(null);
    setView('list');
  }

  function goToCreate() {
    setView('create');
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header__logo" onClick={goToList} style={{ cursor: 'pointer' }}>
          Dutch It
        </span>
        {view === 'list' && (
          <button className="btn btn--primary" onClick={goToCreate}>
            + New Group
          </button>
        )}
      </header>

      <main className="app-main">
        {view === 'list' && <GroupsList onSelectGroup={goToDetail} />}
        {view === 'detail' && <GroupDetail groupId={selectedGroupId} onBack={goToList} />}
        {view === 'create' && (
          <CreateGroup onGroupCreated={goToList} onCancel={goToList} />
        )}
      </main>
    </div>
  );
}

export default App;