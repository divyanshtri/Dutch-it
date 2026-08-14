function GroupSkeleton({ count = 6 }) {
  return (
    <div className="groups-tile-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-panel group-tile-skeleton">
          <span className="skeleton-bar group-tile-skeleton__icon" />
          <span className="skeleton-bar group-tile-skeleton__name" />
          <span className="skeleton-bar group-tile-skeleton__meta" />
        </div>
      ))}
    </div>
  );
}
export default GroupSkeleton;