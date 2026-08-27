function getInitials(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

// One component, used everywhere an avatar appears — photoURL present shows
// the real image; null/missing falls back to initials. Single source of
// truth for that fallback logic, rather than repeating the ternary in
// Navbar AND Account AND anywhere else an avatar might show up later.
function Avatar({ user, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {user.photoURL ? (
      <img
        src={user.photoURL}
        alt={user.fullName}
        className="avatar-img"
        style={style}
      />) : (
        <span className="avatar-initials" style={style}>
          {getInitials(user.fullName)}
        </span>
      )}
      {user.isGhost && <span className="avatar-ghost-dot" title="Unregistered guest" />}
    </span>
  );
}

export default Avatar;
