// activeNav: 'groups' | 'friends' | 'account' — controls which tab is
// highlighted and which view App.jsx renders below the navbar.
function Navbar({ activeNav, onNavChange, searchTerm, onSearchChange, onNewGroup }) {
  return (
    <header className="navbar">
      <div className="navbar__top">
        <span className="app-header__logo">Dutch It</span>

        <input
          type="text"
          className="navbar__search"
          placeholder="Search groups…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <div className="navbar__actions">
          <button className="btn btn--primary btn--nav" onClick={onNewGroup}>
            + New Group
          </button>
          <button className="btn btn--ghost btn--nav" onClick={() => onNavChange('friends')}>
            + Friend
          </button>
          <button className="btn btn--primary btn--nav" onClick={() => onNavChange('account')}>
            Account
          </button>
        </div>
      </div>

      <nav className="navbar__tabs">
        {['groups', 'friends'].map((tab) => (
          <button
            key={tab}
            className={`navbar__tab ${activeNav === tab ? 'navbar__tab--active' : ''}`}
            onClick={() => onNavChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </header>
  );
}

export default Navbar;