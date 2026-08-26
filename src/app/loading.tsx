export default function Loading() {
  return (
    <main className="app-loading-shell" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Arakkis</span>
      <div className="app-loading-header" aria-hidden="true">
        <span className="app-loading-bar app-loading-bar-short" />
        <span className="app-loading-bar app-loading-bar-menu" />
      </div>
      <div className="app-loading-content" aria-hidden="true">
        <span className="app-loading-bar app-loading-bar-title" />
        <span className="app-loading-bar app-loading-bar-copy" />
        <span className="app-loading-rule" />
        <span className="app-loading-block" />
      </div>
    </main>
  );
}
