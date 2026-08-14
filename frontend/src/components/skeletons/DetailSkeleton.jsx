function DetailSkeleton({ rows = 3 }) {
  return (
    <div className="balances-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-balance-row">
          <span className="skeleton-balance-row__name skeleton-bar" />
          <span className="skeleton-balance-row__amount skeleton-bar" />
        </div>
      ))}
    </div>
  );
}
export default DetailSkeleton;