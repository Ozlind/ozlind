export default function WorkspaceRebuildPage() {
  return (
    <main className="workspace-foundation">
      <div className="workspace-foundation__inner">
        <header className="workspace-foundation__topbar">
          <a className="workspace-foundation__brand" href="/app" aria-label="Ozlind workspace home">
            <img src="/ozlind-mark.svg" alt="" width="34" height="34" />
            <span>Ozlind</span>
          </a>
          <div className="workspace-foundation__status" role="status">
            <span className="workspace-foundation__status-dot" aria-hidden="true" />
            Workspace foundation
          </div>
        </header>

        <section className="workspace-foundation__main" aria-labelledby="workspace-title">
          <p className="workspace-foundation__eyebrow">A clearer space to think</p>
          <h1 id="workspace-title" className="workspace-foundation__title">
            Make room for <em>better thinking.</em>
          </h1>
          <p className="workspace-foundation__description">
            Ozlind is being rebuilt around a calmer, more focused workspace. Your account,
            Google sign-in, and existing backend services are being kept intact while the
            new interface is put in place.
          </p>
          <div className="workspace-foundation__rule" aria-hidden="true" />
          <p className="workspace-foundation__footnote">
            This is the foundation stage, not the finished chat experience. Chat and workspace
            features will return only after their interfaces are connected to the existing services
            and verified.
          </p>
        </section>
      </div>
    </main>
  );
}
