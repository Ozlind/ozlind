export default function WorkspaceRebuildPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
        background: "var(--bg, #111216)",
        color: "var(--text, #f1f1f6)",
      }}
    >
      <section style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
        <img src="/ozlind-mark.svg" alt="Ozlind" width="48" height="48" />
        <p style={{ marginTop: 24, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", opacity: .65 }}>
          Ozlind
        </p>
        <h1 style={{ marginTop: 12, fontSize: "clamp(28px, 6vw, 40px)", lineHeight: 1.15, fontWeight: 600 }}>
          A better workspace is taking shape.
        </h1>
        <p style={{ marginTop: 14, lineHeight: 1.7, opacity: .72 }}>
          The previous workspace interface has been cleared for a fresh rebuild. Your account, authentication, and backend data remain in place.
        </p>
      </section>
    </main>
  );
}
