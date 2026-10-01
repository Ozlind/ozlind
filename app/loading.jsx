export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="ozlind-loading"
    >
      <div className="ozlind-loading-mark">
        <span className="ozlind-loading-dot" />
      </div>

      <div className="ozlind-loading-content">
        <div className="ozlind-loading-line ozlind-loading-line-lg" />
        <div className="ozlind-loading-line ozlind-loading-line-sm" />
      </div>

      <span className="sr-only">
        Loading OZLIND AI
      </span>
    </main>
  );
}