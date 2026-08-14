function FriendSkeleton({ rows = 3 }) {
  return (
    <div className="member-select-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-friend-row">
          <span className="skeleton-friend-row__icon skeleton-bar" />
          <div className="skeleton-friend-row__stack">
            <span className="skeleton-friend-row__name skeleton-bar" />
            <span className="skeleton-friend-row__email skeleton-bar" />
          </div>
        </div>
      ))}
    </div>
  );
}
export default FriendSkeleton;