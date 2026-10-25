import type { ReactNode } from "react";

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ width: `${88 - i * 11}%` }} />
      ))}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Failed({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="failed" role="alert">
      <p>{message}</p>
      {retry && (
        <button type="button" className="btn btn--quiet" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
