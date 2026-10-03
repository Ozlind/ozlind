"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("OZLIND application error:", error);
  }, [error]);

  const details = [
    error?.name ? `Name: ${error.name}` : "",
    error?.message ? `Message: ${error.message}` : "",
    error?.digest ? `Digest: ${error.digest}` : "",
    error?.stack ? `Stack: ${String(error.stack).split("\n").slice(0, 6).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main role="alert" className="ozlind-error-page">
      <section className="ozlind-error-card">
        <div className="ozlind-error-mark" aria-hidden="true">
          !
        </div>

        <h1>Something went wrong</h1>

        <p>
          OZLIND could not finish loading this screen. Your saved conversations
          are not intentionally cleared.
        </p>

        <pre
          style={{
            textAlign: "left",
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 220,
            overflow: "auto",
            margin: "0 0 16px",
            padding: 12,
            borderRadius: 10,
            background: "rgba(127,127,127,0.12)",
          }}
        >
          {details || "No error details available."}
        </pre>

        <div className="ozlind-error-actions">
          <button
            type="button"
            onClick={() => reset()}
            className="ozlind-error-primary"
          >
            Try again
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/login";
            }}
            className="ozlind-error-secondary"
          >
            Return to login
          </button>
        </div>
      </section>
    </main>
  );
}