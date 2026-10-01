"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}) {
  useEffect(() => {
    console.error(
      "OZLIND application error:",
      error
    );
  }, [error]);

  return (
    <main
      role="alert"
      className="ozlind-error-page"
    >
      <section className="ozlind-error-card">
        <div
          className="ozlind-error-mark"
          aria-hidden="true"
        >
          !
        </div>

        <h1>
          Something went wrong
        </h1>

        <p>
          OZLIND could not finish loading this
          screen. Your saved local conversations
          are not intentionally cleared.
        </p>

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