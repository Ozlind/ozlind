"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the error boundary observable without exposing internal details to users.
    console.error("Ozlind app boundary caught an error", error);
  }, [error]);

  return (
    <main className="workspace-state" role="alert">
      <section className="workspace-state__card">
        <img className="workspace-state__mark" src="/ozlind-mark.svg" alt="" width="38" height="38" />
        <p className="workspace-state__eyebrow">Ozlind</p>
        <h1>That didn’t go as planned.</h1>
        <p>Your workspace couldn’t finish loading. You can retry without signing out.</p>
        <button className="workspace-state__button" type="button" onClick={() => reset()}>
          Try again
        </button>
      </section>
    </main>
  );
}
