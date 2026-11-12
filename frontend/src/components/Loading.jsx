// ----- Basic loading pieces -----

// Small grey placeholder box that shows while content is loading
export function Skeleton({ className = '' }) {    // Component with an optional extra class name
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;    // Empty span styled as a skeleton, hidden from screen readers
}                                                 // End of Skeleton

// Spinning loader with an optional text label
export function Spinner({ label }) {                             // Component that receives a label text
  return (                                                       // Start of the JSX to show
    <span className="loading-indicator" role={label ? 'status' : undefined}>    {/* Wrapper; role is "status" only if a label exists */}
      <span className="loading-spinner" aria-hidden="true" />    {/* The spinning circle, hidden from screen readers */}
      {label && <span>{label}</span>}                            {/* Show the label text only if one was given */}
    </span>             // End of the wrapper
  );                    // End of the JSX
}                       // End of Spinner

// ----- Admin loading state -----

// Loading box for admin pages: a spinner plus fake table rows
export function AdminLoading({ label, rows = 3 }) {              // Component with a label and a row count (default 3)
  return (                                                       // Start of the JSX to show
    <div className="admin-loading-state" aria-busy="true">       {/* Main box; aria-busy tells screen readers it is loading */}
      <Spinner label={label} />                                  {/* Show the spinner with the label */}
      <div className="admin-loading-rows" aria-hidden="true">    {/* Box that holds the fake rows, hidden from screen readers */}
        {Array.from({ length: rows }, (_, index) => (            // Make an array with "rows" items and loop over it
          <div className="admin-loading-row" key={index}>        {/* One fake row; key helps React track each row */}
            <Skeleton className="admin-loading-line admin-loading-line-primary" />      {/* Long grey line (main text) */}
            <Skeleton className="admin-loading-line admin-loading-line-secondary" />    {/* Shorter grey line (second text) */}
            <Skeleton className="admin-loading-line admin-loading-line-action" />       {/* Small grey line (action button) */}
          </div>                // End of one fake row
        ))}                     {/* End of the loop */}
      </div>                    {/* End of the rows box */}
    </div>                      // End of the main box
  );                            // End of the JSX
}                               // End of AdminLoading

// ----- Facility card skeletons -----

// One fake facility card that looks like a real card while loading
export function FacilityCardSkeleton() {                                     // Component with no props
  return (                                                                   // Start of the JSX to show
    <article className="card facility-card-skeleton" aria-hidden="true">     {/* Card wrapper, hidden from screen readers */}
      <Skeleton className="facility-skeleton-image" />                       {/* Grey box where the photo will be */}
      <div className="card-body">                                            {/* Body area of the card */}
        <div className="facility-skeleton-heading">                          {/* Row for the title and the pill */}
          <Skeleton className="skeleton-line skeleton-title" />              {/* Grey line for the title */}
          <Skeleton className="skeleton-pill" />                             {/* Grey pill shape (like a tag) */}
        </div>                                                               {/* End of the heading row */}
        <Skeleton className="skeleton-line skeleton-description" />          {/* Grey line for the description */}
        <Skeleton className="skeleton-line skeleton-description short" />    {/* Shorter grey description line */}
        <div className="facility-skeleton-footer">                           {/* Row at the bottom of the card */}
          <Skeleton className="skeleton-line skeleton-meta" />               {/* Grey line for small info text */}
          <Skeleton className="skeleton-button" />                           {/* Grey box where the button will be */}
        </div>                          {/* End of the footer row */}
      </div>                            {/* End of the card body */}
    </article>                          // End of the card
  );                                    // End of the JSX
}                                       // End of FacilityCardSkeleton

// A grid of fake facility cards (default is 6)
export function FacilityCardSkeletons({ count = 6 }) {    // Component with a card count (default 6)
  return (                                                // Start of the JSX to show
    <div className="grid facilities-skeleton-grid" role="status" aria-label="Loading facilities">    {/* Grid wrapper; "status" role with a label for screen readers */}
      {Array.from({ length: count }, (_, index) => (      // Make an array with "count" items and loop over it
        <FacilityCardSkeleton key={index} />              // Show one fake card; key helps React track it
      ))}                                                 {/* End of the loop */}
    </div>                                                // End of the grid wrapper
  );                                                      // End of the JSX
}                                                         // End of FacilityCardSkeletons