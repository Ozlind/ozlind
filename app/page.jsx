"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OzlindApp from "@/components/OzlindApp";
import { createClient } from "@/lib/supabase/client";

function OzlindMark({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <use href="/ozlind-icons.svg#ozl-mark" />
    </svg>
  );
}

function BootScreen() {
  return (
    <main
      className="ozlind-boot"
      aria-label="Loading OZLIND AI"
      aria-busy="true"
    >
      <div className="ozlind-boot-orb ozlind-boot-orb-one" />
      <div className="ozlind-boot-orb ozlind-boot-orb-two" />

      <div className="ozlind-boot-content">
        <div className="ozlind-boot-logo-wrap">
          <OzlindMark className="ozlind-boot-logo" />
        </div>

        <div className="ozlind-boot-wordmark">
          <strong>OZLIND</strong>
          <span>AI</span>
        </div>

        <div className="ozlind-boot-loader" aria-hidden="true">
          <span />
        </div>

        <p>Initializing your workspace</p>
      </div>
    </main>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <main
      className="ozlind-boot"
      aria-label="OZLIND AI could not start"
    >
      <div className="ozlind-boot-content">
        <div className="ozlind-boot-logo-wrap">
          <OzlindMark className="ozlind-boot-logo" />
        </div>

        <div className="ozlind-boot-wordmark">
          <strong>OZLIND</strong>
          <span>AI</span>
        </div>

        <p style={{ color: "var(--danger, #d6493a)" }}>{message}</p>

        <button
          type="button"
          className="primary-button"
          onClick={onRetry}
          style={{ marginTop: "12px" }}
        >
          Retry
        </button>
      </div>
    </main>
  );
}

export default function Page() {
  const router = useRouter();
  const [status, setStatus] = useState("booting");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    let timer;

    async function initialize() {
      setStatus("booting");
      setErrorMessage("");

      try {
        const supabase = await createClient();

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const session = data?.session;

        if (!mounted) return;

        timer = window.setTimeout(() => {
          if (!mounted) return;

          if (session) {
            setStatus("ready");
          } else {
            router.replace("/login");
          }
        }, 1100);
      } catch (error) {
        // Do NOT treat "couldn't check the session" the same as
        // "definitely not signed in" — that silently bounces a
        // signed-in user back to /login whenever config, network,
        // or the Supabase env vars are broken, which looks like a
        // login bug but is really a setup/connectivity problem.
        console.error("OZLIND session initialization failed:", error);

        if (!mounted) return;

        setStatus("error");
        setErrorMessage(
          error?.message ||
            "Could not verify your session. Check your connection and Supabase configuration."
        );
      }
    }

    initialize();

    return () => {
      mounted = false;

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [router, attempt]);

  if (status === "error") {
    return (
      <ErrorScreen
        message={errorMessage}
        onRetry={() => setAttempt((current) => current + 1)}
      />
    );
  }

  if (status !== "ready") {
    return <BootScreen />;
  }

  return <OzlindApp />;
}