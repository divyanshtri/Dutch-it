import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Navbar from './components/Navbar';
import GroupsList from './components/GroupsList';
import GroupDetail from './components/GroupDetail';
import CreateGroup from './components/CreateGroup';
import Friends from './components/Friends';
import Account from './components/Account';

// The actual app content, SEPARATE from AuthProvider itself — this is a
// required pattern: useAuth() only works INSIDE a component that's a
// descendant of <AuthProvider>, not in the same component that renders
// the provider. So App just sets up the provider, and everything that
// needs auth state lives in AppContent underneath it.
function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [activeNav, setActiveNav] = useState('groups'); // 'groups' | 'friends' | 'account'
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'create' — nested WITHIN the 'groups' tab
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  function goToDetail(groupId) {
    setSelectedGroupId(groupId);
    setView('detail');
  }

  function goToList() {
    setSelectedGroupId(null);
    setView('list');
  }

  function handleNavChange(tab) {
    setActiveNav(tab);
    if (tab === 'groups') setView('list'); // reset to list view whenever returning to Groups tab
  }

  // While checking session on load, show loading state
  if (loading) return <p className="status-text">Loading…</p>;

  // Unauthenticated view
  if (!isAuthenticated) {
    return authView === 'login' ? (
      <Login onSwitchToSignup={() => setAuthView('signup')} />
    ) : (
      <Signup onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  // Authenticated view with Navbar navigation
  return (
    <div className="app">
      <Navbar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onNewGroup={() => {
          setActiveNav('groups');
          setView('create');
        }}
      />

      <main className="app-main">
        {activeNav === 'groups' && view === 'list' && (
          <GroupsList onSelectGroup={goToDetail} searchTerm={searchTerm} />
        )}
        {activeNav === 'groups' && view === 'detail' && (
          <GroupDetail groupId={selectedGroupId} onBack={goToList} />
        )}
        {activeNav === 'groups' && view === 'create' && (
          <CreateGroup onGroupCreated={goToList} onCancel={goToList} />
        )}
        {activeNav === 'friends' && <Friends />}
        {activeNav === 'account' && <Account />}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;