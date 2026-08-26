"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="public-error-page" aria-labelledby="public-error-title">
      <div className="public-error-content">
        <div className="public-error-status">
          50<span className="public-error-status-dial">0</span>
        </div>
        <div className="public-error-divider" aria-hidden="true" />
        <div className="public-error-copy">
          <h1 id="public-error-title">Something went wrong.</h1>
          <p>Please try again.</p>
          <button className="public-error-action" type="button" onClick={() => reset()}>
            Try again <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </main>
  );
}
