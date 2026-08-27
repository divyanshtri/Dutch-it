import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import GroupDetail from './components/GroupDetail';
import CreateGroup from './components/CreateGroup';
import Friends from './components/Friends';
import Account from './components/Account';
import Fab from './components/Fab';
import SimpleExpenseModal from './components/SimpleExpenseModal';
import ReceiptScannerModal from './components/ReceiptScannerModal';
import UniversalReceiptParserModal from './components/UniversalReceiptParserModal';
import PublicSummary from './components/PublicSummary';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [activeNav, setActiveNav] = useState('groups'); // 'groups' | 'friends' | 'account'
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'create'
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showUniversalParser, setShowUniversalParser] = useState(false);

  const publicMatch = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  if (publicMatch) return <PublicSummary shareToken={decodeURIComponent(publicMatch[1])} />;

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
    if (tab === 'groups') setView('list');
  }

  if (loading) return <p className="status-text">Loading…</p>;

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <Login onSwitchToSignup={() => setAuthView('signup')} />
    ) : (
      <Signup onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return (
    <div className="app">
      <Navbar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <main className="app-main">
        {activeNav === 'groups' && view === 'list' && (
          <Dashboard
            onSelectGroup={goToDetail}
            searchTerm={searchTerm}
            onNewGroup={() => setView('create')}
            onAddFriend={() => setActiveNav('friends')}
          />
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

      <Fab
        onQuickExpense={() => setShowQuickExpense(true)}
        onScanReceipt={() => setShowScanner(true)}
        onUniversalParse={activeNav === 'groups' && view === 'list'
          ? () => setShowUniversalParser(true)
          : undefined}
      />

      {/* Global Quick Expense Modal */}
      {showQuickExpense && (
        <SimpleExpenseModal
          onClose={() => setShowQuickExpense(false)}
          onCreated={() => {
            setShowQuickExpense(false);
            setActiveNav('groups');
            setView('list');
          }}
          onNewGroup={() => {
            setShowQuickExpense(false);
            setActiveNav('groups');
            setView('create');
          }}
        />
      )}

      {/* Standalone Receipt Scanner Modal */}
      {showScanner && (
        <ReceiptScannerModal
          onClose={() => setShowScanner(false)}
          onCreated={() => {
            setShowScanner(false);
            setActiveNav('groups');
            setView('list');
          }}
          onNewGroup={() => {
            setShowScanner(false);
            setActiveNav('groups');
            setView('create');
          }}
        />
      )}

      {showUniversalParser && (
        <UniversalReceiptParserModal onClose={() => setShowUniversalParser(false)} />
      )}
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
