"use client";

import { useEffect } from "react";

/*
 * global-error replaces the root layout when the layout itself fails,
 * so it cannot rely on globals.css. Styles are inline on purpose.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("OZLIND fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0B0C0E",
          color: "#F4F4F6",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <main role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>
            OZLIND hit a problem
          </h1>
          <p style={{ margin: "0 0 24px", color: "#A9A9B4", lineHeight: 1.6 }}>
            Something went wrong while loading the app. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "12px 22px",
              borderRadius: 12,
              border: 0,
              background: "#7057F7",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}