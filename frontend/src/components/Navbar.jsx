// Navbar.jsx — full file
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

function Navbar({ activeNav, onNavChange, searchTerm, onSearchChange }) {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="navbar-float-wrap">
      <header className={`navbar-pill ${searchOpen ? 'navbar-pill--expanded' : ''}`}>
        <div className="navbar-pill__row">
          <span className="app-header__logo app-header__logo--pill" onClick={() => onNavChange('groups')}>
            Dutch<span className="accent-dash">-</span>it
          </span>

          <nav className="navbar-pill__links">
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

          <button
            className={`navbar-search-toggle ${searchOpen ? 'navbar-search-toggle--active' : ''}`}
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Toggle search"
          >
            <span className="material-symbols-outlined">search</span>
          </button>

          <button className="navbar-avatar-btn" onClick={() => onNavChange('account')}>
            <Avatar user={user} size={36} />
          </button>
        </div>

        {/* Reveal panel — height-animated, not display:none toggled, so the
            transition is visible instead of an instant cut. */}
        <div className="navbar-search-reveal">
          <input
            type="text"
            className="input-flat navbar-search-reveal__input"
            placeholder="Search groups…"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus={searchOpen}
          />
        </div>
      </header>
    </div>
  );
}
export default Navbar;