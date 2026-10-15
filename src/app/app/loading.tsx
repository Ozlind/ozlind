export default function Loading() {
  return (
    <main className="workspace-state" aria-busy="true" aria-live="polite">
      <section className="workspace-state__card">
        <img className="workspace-state__mark" src="/ozlind-mark.svg" alt="" width="38" height="38" />
        <p className="workspace-state__eyebrow">Ozlind</p>
        <div className="workspace-state__spinner" aria-hidden="true" />
        <p>Preparing your workspace…</p>
      </section>
    </main>
  );
}
