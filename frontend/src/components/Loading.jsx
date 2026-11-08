export function Skeleton({ className = '' }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function Spinner({ label }) {
  return (
    <span className="loading-indicator" role={label ? 'status' : undefined}>
      <span className="loading-spinner" aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function AdminLoading({ label, rows = 3 }) {
  return (
    <div className="admin-loading-state" aria-busy="true">
      <Spinner label={label} />
      <div className="admin-loading-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div className="admin-loading-row" key={index}>
            <Skeleton className="admin-loading-line admin-loading-line-primary" />
            <Skeleton className="admin-loading-line admin-loading-line-secondary" />
            <Skeleton className="admin-loading-line admin-loading-line-action" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FacilityCardSkeleton() {
  return (
    <article className="card facility-card-skeleton" aria-hidden="true">
      <Skeleton className="facility-skeleton-image" />
      <div className="card-body">
        <div className="facility-skeleton-heading">
          <Skeleton className="skeleton-line skeleton-title" />
          <Skeleton className="skeleton-pill" />
        </div>
        <Skeleton className="skeleton-line skeleton-description" />
        <Skeleton className="skeleton-line skeleton-description short" />
        <div className="facility-skeleton-footer">
          <Skeleton className="skeleton-line skeleton-meta" />
          <Skeleton className="skeleton-button" />
        </div>
      </div>
    </article>
  );
}

export function FacilityCardSkeletons({ count = 6 }) {
  return (
    <div className="grid facilities-skeleton-grid" role="status" aria-label="Loading facilities">
      {Array.from({ length: count }, (_, index) => <FacilityCardSkeleton key={index} />)}
    </div>
  );
}
